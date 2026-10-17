import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { invalidateActiveBaremeCache } from './getActiveBaremeData'
import { logPublicationEvent } from './publicationLog'
import { readSnapshot } from './comparisonReview'

export interface PublishBaremeOptions {
  /** Identité loggée dans BaremeFile.publishedBy (typiquement email). */
  publishedBy?: string | null
  /** Conservé pour compatibilité API : les erreurs ne sont jamais contournables. */
  force?: boolean
  /** Si true, autorise le passage pending_approval -> published après 2 approbations. */
  bypassApprovalCheck?: boolean
}

type PublicationFailureReason =
  | 'not_draft'
  | 'has_errors'
  | 'not_found'
  | 'requires_approval'
  | 'missing_valid_from'
  | 'future_valid_from'
  | 'missing_source'
  | 'concurrent_update'
  | 'comparison_unavailable'
  | 'comparison_not_reviewed'
  | 'comparison_stale'

export type PublishResult =
  | { status: 'published'; fileId: string; archivedPreviousId: string | null }
  | { status: 'error'; reason: PublicationFailureReason; message: string }

type PublicationCandidate = {
  id: string
  status: string
  fileType: string
  alerts: unknown
  validFrom: Date | null
  requiresApproval: boolean
  fileHash: string | null
  filePath: string
  diagnostics: unknown
}

class PublicationStateChangedError extends Error {}

function validatePublicationCandidate(
  file: PublicationCandidate,
  options: PublishBaremeOptions
): Extract<PublishResult, { status: 'error' }> | null {
  const isValidSource =
    file.status === 'draft' ||
    (options.bypassApprovalCheck && file.status === 'pending_approval')
  if (!isValidSource) {
    return {
      status: 'error',
      reason: 'not_draft',
      message: `L'import a le statut "${file.status}" — seuls les brouillons validés peuvent être publiés`,
    }
  }
  if (file.requiresApproval && !options.bypassApprovalCheck) {
    return {
      status: 'error',
      reason: 'requires_approval',
      message:
        "Ce barème exige une double approbation. Utiliser le workflow d'approbation au lieu de la publication directe.",
    }
  }
  if (!file.validFrom) {
    return {
      status: 'error',
      reason: 'missing_valid_from',
      message: "Date d'effet absente ou illisible — publication automatique bloquée.",
    }
  }
  if (file.validFrom.getTime() > Date.now()) {
    return {
      status: 'error',
      reason: 'future_valid_from',
      message: "La date d'effet est future — conserver ce barème en brouillon jusqu'à son entrée en vigueur.",
    }
  }
  // Les imports récents disposent d'un hash. Sans référence vers l'original,
  // ils ne sont pas auditables et ne peuvent donc pas remplacer le publié.
  if (file.fileHash && !file.filePath) {
    return {
      status: 'error',
      reason: 'missing_source',
      message: "Le fichier source original n'est pas disponible — publication bloquée.",
    }
  }

  const alerts = (file.alerts ?? []) as Array<{ level?: string; severity?: string }>
  const criticalCount = alerts.filter((a) => a?.severity === 'critical').length
  const errorCount = alerts.filter((a) => a?.level === 'error').length
  if (criticalCount > 0 || errorCount > 0) {
    const details = [
      criticalCount > 0 ? `${criticalCount} alerte(s) de gravité "critical"` : null,
      errorCount > 0 ? `${errorCount} alerte(s) de niveau "error"` : null,
    ]
      .filter(Boolean)
      .join(', ')
    return {
      status: 'error',
      reason: 'has_errors',
      message: `${details} — publication impossible, corriger l'import d'abord.`,
    }
  }
  return null
}

function isConcurrentPublicationError(error: unknown): boolean {
  return (
    error instanceof PublicationStateChangedError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
  )
}

/**
 * Publie un import dont la date d'effet est arrivée.
 *
 * La fiche est relue dans une transaction serializable avant toute transition.
 * Ainsi, un double clic ou une publication concurrente ne peut pas archiver un
 * publié sur la base d'un état devenu obsolète.
 */
export async function publishBaremeImport(
  fileId: string,
  options: PublishBaremeOptions = {}
): Promise<PublishResult> {
  let fromStatus: string | null = null
  try {
    const result = await withDbRetry(() =>
      prisma.$transaction(
        async (tx): Promise<PublishResult> => {
          const file = await tx.baremeFile.findUnique({
            where: { id: fileId },
            select: {
              id: true,
              status: true,
              fileType: true,
              alerts: true,
              validFrom: true,
              requiresApproval: true,
              fileHash: true,
              filePath: true,
              diagnostics: true,
            },
          })
          if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable' }

          fromStatus = file.status
          const failure = validatePublicationCandidate(file, options)
          if (failure) return failure

          const snapshot = readSnapshot(file.diagnostics)
          if (!snapshot || snapshot.state === 'reference_unavailable') {
            return { status: 'error', reason: 'comparison_unavailable', message: 'La comparaison exploitable est absente : publication bloquée.' }
          }
          const currentReference = await tx.baremeFile.findFirst({
            where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
            orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
          })
          if ((snapshot.reference?.id ?? null) !== (currentReference?.id ?? null)) {
            return { status: 'error', reason: 'comparison_stale', message: 'La référence publiée a changé depuis la comparaison : actualiser puis revoir l’import.' }
          }
          const review = await tx.baremePublicationLog.findFirst({
            where: { fileId, action: 'comparison_reviewed' }, orderBy: { createdAt: 'desc' }, select: { details: true },
          })
          const reviewedSnapshot = (review?.details as { comparison?: ReturnType<typeof readSnapshot> } | null)?.comparison
          if (!reviewedSnapshot) {
            return { status: 'error', reason: 'comparison_not_reviewed', message: 'La revue explicite de la comparaison est requise avant publication.' }
          }
          if (reviewedSnapshot.candidate.dataRevision !== snapshot.candidate.dataRevision || reviewedSnapshot.reference?.dataRevision !== snapshot.reference?.dataRevision) {
            return { status: 'error', reason: 'comparison_stale', message: 'La revue enregistrée ne porte plus sur la révision actuelle de comparaison.' }
          }

          const previous = await tx.baremeFile.findFirst({
            where: {
              status: 'published',
              fileType: file.fileType,
              NOT: { id: fileId },
            },
            orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
            select: { id: true },
          })
          if (previous) {
            await tx.baremeFile.update({ where: { id: previous.id }, data: { status: 'archived' } })
          }

          const updated = await tx.baremeFile.updateMany({
            where: { id: fileId, status: file.status },
            data: {
              status: 'published',
              publishedAt: new Date(),
              publishedBy: options.publishedBy ?? null,
            },
          })
          if (updated.count !== 1) {
            // Ne jamais retourner après avoir archivé `previous` : un throw
            // force le rollback de toute la transition.
            throw new PublicationStateChangedError()
          }
          return { status: 'published', fileId, archivedPreviousId: previous?.id ?? null }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 30_000,
        }
      )
    )
    if (result.status === 'error') return result

    invalidateActiveBaremeCache()
    if (result.archivedPreviousId) {
      await logPublicationEvent({
        fileId: result.archivedPreviousId,
        action: 'archived',
        fromStatus: 'published',
        toStatus: 'archived',
        actorEmail: options.publishedBy,
        details: { reason: 'replaced_by', replacedById: fileId },
      })
    }
    await logPublicationEvent({
      fileId,
      action: 'published',
      fromStatus,
      toStatus: 'published',
      actorEmail: options.publishedBy,
      details: { archivedPreviousId: result.archivedPreviousId },
    })
    return result
  } catch (error) {
    if (isConcurrentPublicationError(error)) {
      return {
        status: 'error',
        reason: 'concurrent_update',
        message: "Une autre publication est en cours pour cette famille — réessayer après actualisation.",
      }
    }
    throw error
  }
}

/** Rejette un import encore dans le workflow, sans pouvoir rétrograder un publié. */
export async function rejectBaremeImport(
  fileId: string,
  rejectedBy?: string | null
): Promise<{ status: 'rejected' } | { status: 'error'; message: string }> {
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({ where: { id: fileId }, select: { status: true } })
  )
  if (!file) return { status: 'error', message: 'Import introuvable' }
  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return { status: 'error', message: `Seuls les brouillons peuvent être rejetés (statut actuel: ${file.status})` }
  }
  const updated = await withDbRetry(() =>
    prisma.baremeFile.updateMany({
      where: { id: fileId, status: { in: ['draft', 'pending_approval'] } },
      data: { status: 'rejected', publishedBy: rejectedBy ?? null },
    })
  )
  if (updated.count !== 1) {
    return { status: 'error', message: "L'import a changé pendant le rejet — actualiser puis réessayer." }
  }
  await logPublicationEvent({
    fileId,
    action: 'rejected',
    fromStatus: file.status,
    toStatus: 'rejected',
    actorEmail: rejectedBy,
  })
  return { status: 'rejected' }
}

/** Restaure explicitement une version archivée dans une transaction serializable. */
export async function rollbackToVersion(
  fileId: string,
  actorEmail?: string | null
): Promise<
  | { status: 'rolled_back'; archivedPreviousId: string | null }
  | { status: 'error'; message: string }
> {
  try {
    const result = await withDbRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const file = await tx.baremeFile.findUnique({
            where: { id: fileId },
            select: { id: true, status: true, fileType: true },
          })
          if (!file) return { status: 'error' as const, message: 'Fichier introuvable' }
          if (file.status !== 'archived') {
            return {
              status: 'error' as const,
              message: `Seuls les fichiers archivés peuvent être restaurés (statut actuel: ${file.status})`,
            }
          }
          const current = await tx.baremeFile.findFirst({
            where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
            select: { id: true },
          })
          if (current) {
            await tx.baremeFile.update({ where: { id: current.id }, data: { status: 'archived' } })
          }
          const restored = await tx.baremeFile.updateMany({
            where: { id: fileId, status: 'archived' },
            data: { status: 'published', publishedAt: new Date(), publishedBy: actorEmail ?? null },
          })
          if (restored.count !== 1) {
            // Même garantie que la publication : l'archivage du courant doit
            // être annulé si la cible n'est plus archivée.
            throw new PublicationStateChangedError()
          }
          return { status: 'rolled_back' as const, archivedPreviousId: current?.id ?? null }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 30_000,
        }
      )
    )
    if (result.status === 'error') return result

    invalidateActiveBaremeCache()
    if (result.archivedPreviousId) {
      await logPublicationEvent({
        fileId: result.archivedPreviousId,
        action: 'archived',
        fromStatus: 'published',
        toStatus: 'archived',
        actorEmail,
        details: { reason: 'rolled_back_to', rolledBackToId: fileId },
      })
    }
    await logPublicationEvent({
      fileId,
      action: 'rollback',
      fromStatus: 'archived',
      toStatus: 'published',
      actorEmail,
      details: { archivedPreviousId: result.archivedPreviousId },
    })
    return result
  } catch (error) {
    if (isConcurrentPublicationError(error)) {
      return { status: 'error', message: 'Une autre publication est en cours — actualiser puis réessayer.' }
    }
    throw error
  }
}
