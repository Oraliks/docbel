import { prisma, withDbRetry } from '@/lib/prisma'
import { invalidateActiveBaremeCache } from './getActiveBaremeData'
import { logPublicationEvent } from './publicationLog'

export interface PublishBaremeOptions {
  /** Identité loggée dans BaremeFile.publishedBy (typiquement email). */
  publishedBy?: string | null
  /** Si true, autorise la publication même si des alertes 'error' existent. */
  force?: boolean
  /** Si true, bypass le contrôle requiresApproval (utilisé par le flow 4 yeux). */
  bypassApprovalCheck?: boolean
}

export type PublishResult =
  | {
      status: 'published'
      fileId: string
      archivedPreviousId: string | null
    }
  | {
      status: 'error'
      reason: 'not_draft' | 'has_errors' | 'not_found' | 'requires_approval'
      message: string
    }

/**
 * Publie un import :
 *   - vérifie status="draft" (ou "pending_approval" si bypassApprovalCheck)
 *   - vérifie l'absence d'alertes 'error' (sauf force=true)
 *   - vérifie qu'il n'a pas besoin d'approbation (sauf bypassApprovalCheck)
 *   - archive le précédent published de même fileType
 *   - passe à status="published"
 *
 * Transactionnel : si quoi que ce soit échoue, l'ancien published reste actif.
 * Log automatique dans BaremePublicationLog (archive + publish).
 */
export async function publishBaremeImport(
  fileId: string,
  options: PublishBaremeOptions = {}
): Promise<PublishResult> {
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        status: true,
        fileType: true,
        alerts: true,
        validFrom: true,
        requiresApproval: true,
      },
    })
  )

  if (!file) {
    return { status: 'error', reason: 'not_found', message: 'Import introuvable' }
  }

  const isValidSource =
    file.status === 'draft' ||
    (options.bypassApprovalCheck && file.status === 'pending_approval')
  if (!isValidSource) {
    return {
      status: 'error',
      reason: 'not_draft',
      message: `L'import a le statut "${file.status}" — seuls les drafts peuvent être publiés`,
    }
  }

  // Workflow 4 yeux : si requiresApproval, refuser sauf bypass
  if (file.requiresApproval && !options.bypassApprovalCheck) {
    return {
      status: 'error',
      reason: 'requires_approval',
      message:
        'Ce barème exige une double approbation. Utiliser le workflow d\'approbation au lieu de la publication directe.',
    }
  }

  const alerts = (file.alerts ?? []) as Array<{ level?: string; severity?: string }>

  // Les alertes 'critical' bloquent TOUJOURS, même avec force : on ne publie
  // jamais un barème dont l'intégrité même est compromise.
  const criticalCount = alerts.filter((a) => a?.severity === 'critical').length
  if (criticalCount > 0) {
    return {
      status: 'error',
      reason: 'has_errors',
      message: `${criticalCount} alerte(s) de gravité "critical" — publication impossible, corriger l'import d'abord`,
    }
  }

  // Vérification des erreurs (sauf si force)
  if (!options.force) {
    const errorCount = alerts.filter((a) => a?.level === 'error').length
    if (errorCount > 0) {
      return {
        status: 'error',
        reason: 'has_errors',
        message: `${errorCount} alerte(s) de niveau "error" détectée(s) — utilisez force pour publier malgré tout`,
      }
    }
  }

  const result = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      // 1. Trouver l'ancien published à archiver (même fileType)
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
        await tx.baremeFile.update({
          where: { id: previous.id },
          data: { status: 'archived' },
        })
      }

      // 2. Publier le draft
      await tx.baremeFile.update({
        where: { id: fileId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: options.publishedBy ?? null,
        },
      })

      return { archivedPreviousId: previous?.id ?? null }
    })
  )

  invalidateActiveBaremeCache()

  // Audit (best-effort hors transaction)
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
    action: options.force ? 'force_published' : 'published',
    fromStatus: file.status,
    toStatus: 'published',
    actorEmail: options.publishedBy,
    details: {
      archivedPreviousId: result.archivedPreviousId,
      forced: options.force ?? false,
    },
  })

  return {
    status: 'published',
    fileId,
    archivedPreviousId: result.archivedPreviousId,
  }
}

/**
 * Rejette un import en draft (passe à status="rejected").
 * Log automatique dans BaremePublicationLog.
 */
export async function rejectBaremeImport(
  fileId: string,
  rejectedBy?: string | null
): Promise<{ status: 'rejected' } | { status: 'error'; message: string }> {
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { id: fileId },
      select: { status: true },
    })
  )
  if (!file) return { status: 'error', message: 'Import introuvable' }
  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return {
      status: 'error',
      message: `Seuls les drafts/pending peuvent être rejetés (statut actuel: ${file.status})`,
    }
  }

  await withDbRetry(() =>
    prisma.baremeFile.update({
      where: { id: fileId },
      data: {
        status: 'rejected',
        publishedBy: rejectedBy ?? null,
      },
    })
  )

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
 * Rollback : restaure une version archivée comme nouvelle version publiée.
 *
 * Archive le published actuel et republie l'ancien. Crée un événement
 * 'rollback' dans le log pour audit. Utile en cas d'erreur découverte
 * après publication.
 */
export async function rollbackToVersion(
  fileId: string,
  actorEmail?: string | null
): Promise<
  | { status: 'rolled_back'; archivedPreviousId: string | null }
  | { status: 'error'; message: string }
> {
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { id: fileId },
      select: { id: true, status: true, fileType: true },
    })
  )
  if (!file) return { status: 'error', message: 'Fichier introuvable' }
  if (file.status !== 'archived') {
    return {
      status: 'error',
      message: `Seuls les fichiers archivés peuvent être restaurés (statut actuel: ${file.status})`,
    }
  }

  const result = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      // Archiver le published actuel
      const current = await tx.baremeFile.findFirst({
        where: {
          status: 'published',
          fileType: file.fileType,
          NOT: { id: fileId },
        },
        select: { id: true },
      })
      if (current) {
        await tx.baremeFile.update({
          where: { id: current.id },
          data: { status: 'archived' },
        })
      }

      // Restaurer
      await tx.baremeFile.update({
        where: { id: fileId },
        data: {
          status: 'published',
          publishedAt: new Date(),
          publishedBy: actorEmail ?? null,
        },
      })

      return { archivedPreviousId: current?.id ?? null }
    })
  )

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

  return { status: 'rolled_back', archivedPreviousId: result.archivedPreviousId }
}
