import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { invalidateActiveBaremeCache } from './getActiveBaremeData'
import { logPublicationEvent } from './publicationLog'
import { readSnapshot } from './comparisonReview'
import { brusselsCalendarDay, parseCalendarDate } from './calendar-date'

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
  if (file.validFrom > parseCalendarDate(brusselsCalendarDay())!) {
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
          if (reviewedSnapshot.candidate.id !== snapshot.candidate.id
            || (reviewedSnapshot.reference?.id ?? null) !== (snapshot.reference?.id ?? null)
            || reviewedSnapshot.computedAt !== snapshot.computedAt
            || reviewedSnapshot.candidate.dataRevision !== snapshot.candidate.dataRevision
            || (reviewedSnapshot.reference?.dataRevision ?? null) !== (snapshot.reference?.dataRevision ?? null)) {
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

/**
 * Restaure une version réellement publiée. Le courant et les versions qui
 * gagneraient contre la cible sont retirés, y compris les archives intermédiaires :
 * après C -> A, B ne doit pas redevenir le barème applicable.
 */
export async function rollbackToVersion(
  fileId: string,
  actorEmail?: string | null
): Promise<
  | { status: 'rolled_back'; archivedPreviousId: string | null; revokedFileIds: string[] }
  | { status: 'error'; message: string }
> {
  try {
    const result = await withDbRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const file = await tx.baremeFile.findUnique({
            where: { id: fileId },
            select: { id: true, status: true, fileType: true, validFrom: true, publishedAt: true },
          })
          if (!file) return { status: 'error' as const, message: 'Fichier introuvable' }
          if (file.status !== 'archived') {
            return {
              status: 'error' as const,
              message: `Seuls les fichiers archivés peuvent être restaurés (statut actuel: ${file.status})`,
            }
          }
          const readAt = new Date()
          const today = parseCalendarDate(brusselsCalendarDay(readAt))!
          if (!file.validFrom || file.validFrom > today || !file.publishedAt || file.publishedAt > readAt) {
            return {
              status: 'error' as const,
              message: "La restauration exige une date d'effet applicable et une publication antérieure vérifiable.",
            }
          }

          const current = await tx.baremeFile.findFirst({
            where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
            orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
            select: { id: true },
          })
          const withdrawWhere: Prisma.BaremeFileWhereInput = {
            fileType: file.fileType,
            NOT: { id: fileId },
            OR: [
              { status: 'published' },
              {
                status: 'archived',
                publishedAt: { not: null },
                OR: [
                  { validFrom: { gt: file.validFrom } },
                  { validFrom: file.validFrom, publishedAt: { gt: file.publishedAt } },
                  { validFrom: file.validFrom, publishedAt: file.publishedAt, id: { gt: file.id } },
                ],
              },
            ],
          }
          const revokedFiles: Array<{ id: string; status: string }> = []
          for (;;) {
            const page = await tx.baremeFile.findMany({
              where: withdrawWhere,
              orderBy: { id: 'asc' },
              take: 1000,
              select: { id: true, status: true },
            })
            if (page.length === 0) break
            const revoked = await tx.baremeFile.updateMany({
              where: { ...withdrawWhere, id: { in: page.map((candidate) => candidate.id) } },
              data: { status: 'revoked' },
            })
            if (revoked.count !== page.length) throw new PublicationStateChangedError()
            revokedFiles.push(...page)
            if (page.length < 1000) break
          }
          const restored = await tx.baremeFile.updateMany({
            where: { id: fileId, status: 'archived' },
            // publishedAt conserve la première publication, pas la date du rollback.
            data: { status: 'published', publishedBy: actorEmail ?? null },
          })
          if (restored.count !== 1) throw new PublicationStateChangedError()

          // Le journal de retrait est atomique avec les statuts : le rollback
          // reste explicable même si le journal best-effort extérieur échoue.
          await tx.baremePublicationLog.createMany({
            data: [
              ...revokedFiles.map((revoked) => ({
                fileId: revoked.id,
                action: 'revoked',
                fromStatus: revoked.status,
                toStatus: 'revoked',
                actorEmail: actorEmail ?? null,
                details: { reason: 'rolled_back_to', rolledBackToId: fileId },
              })),
              {
                fileId,
                action: 'rollback',
                fromStatus: 'archived',
                toStatus: 'published',
                actorEmail: actorEmail ?? null,
                details: { archivedPreviousId: current?.id ?? null, revokedFileIds: revokedFiles.map((revoked) => revoked.id) },
              },
            ],
          })
          return {
            status: 'rolled_back' as const,
            // Nom conservé pour compatibilité des clients ; le statut est revoked.
            archivedPreviousId: current?.id ?? null,
            revokedFileIds: revokedFiles.map((revoked) => revoked.id),
          }
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
    return result
  } catch (error) {
    if (isConcurrentPublicationError(error)) {
      return { status: 'error', message: 'Une autre publication est en cours — actualiser puis réessayer.' }
    }
    throw error
  }
}
