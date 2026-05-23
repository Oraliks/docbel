import { prisma, withDbRetry } from '@/lib/prisma'
import { publishBaremeImport } from './publishBaremeImport'
import { logPublicationEvent } from './publicationLog'

export const REQUIRED_APPROVALS_COUNT = 2

export interface ApproveBaremeOptions {
  approverEmail: string
  approverName?: string | null
  comment?: string | null
}

export type ApproveResult =
  | {
      status: 'recorded'
      approvalsCount: number
      requiredCount: number
      autoPublished: boolean
    }
  | {
      status: 'already_approved'
      approvalsCount: number
    }
  | {
      status: 'error'
      message: string
    }

/**
 * Enregistre une approbation 4-yeux pour un import en attente.
 *
 * Règles :
 *   - L'import doit être en status='draft' ou 'pending_approval'
 *   - Le même approbateur ne peut approuver qu'une fois (contrainte DB)
 *   - Quand le compteur atteint REQUIRED_APPROVALS_COUNT (distincts),
 *     l'import est automatiquement publié (via publishBaremeImport en bypass)
 *   - Le premier approbateur fait passer le status à 'pending_approval'
 *     (sauf si requiresApproval=false, dans ce cas l'approbation est juste loggée)
 */
export async function approveBaremeImport(
  fileId: string,
  options: ApproveBaremeOptions
): Promise<ApproveResult> {
  const file = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        status: true,
        requiresApproval: true,
        approvals: { select: { approverEmail: true } },
      },
    })
  )
  if (!file) return { status: 'error', message: 'Import introuvable' }

  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return {
      status: 'error',
      message: `Approbation impossible — statut actuel: ${file.status}`,
    }
  }

  // Déjà approuvé par cet utilisateur ?
  if (file.approvals.some((a) => a.approverEmail === options.approverEmail)) {
    return { status: 'already_approved', approvalsCount: file.approvals.length }
  }

  try {
    await withDbRetry(() =>
      prisma.baremeApproval.create({
        data: {
          fileId,
          approverEmail: options.approverEmail,
          approverName: options.approverName ?? null,
          comment: options.comment ?? null,
        },
      })
    )
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Échec enregistrement',
    }
  }

  const approvalsCount = file.approvals.length + 1

  await logPublicationEvent({
    fileId,
    action: 'approved',
    fromStatus: file.status,
    toStatus: file.status,
    actorEmail: options.approverEmail,
    details: {
      approvalsCount,
      requiredCount: REQUIRED_APPROVALS_COUNT,
    },
  })

  // Si on n'exige pas d'approbations, c'est juste informatif
  if (!file.requiresApproval) {
    return {
      status: 'recorded',
      approvalsCount,
      requiredCount: REQUIRED_APPROVALS_COUNT,
      autoPublished: false,
    }
  }

  // Première approbation : passer en pending_approval
  if (file.status === 'draft' && approvalsCount < REQUIRED_APPROVALS_COUNT) {
    await withDbRetry(() =>
      prisma.baremeFile.update({
        where: { id: fileId },
        data: { status: 'pending_approval' },
      })
    )
    await logPublicationEvent({
      fileId,
      action: 'submitted_for_approval',
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      actorEmail: options.approverEmail,
    })
  }

  // Seuil atteint : auto-publish
  if (approvalsCount >= REQUIRED_APPROVALS_COUNT) {
    const result = await publishBaremeImport(fileId, {
      publishedBy: options.approverEmail,
      bypassApprovalCheck: true,
    })
    if (result.status === 'published') {
      return {
        status: 'recorded',
        approvalsCount,
        requiredCount: REQUIRED_APPROVALS_COUNT,
        autoPublished: true,
      }
    }
    // Si auto-publish échoue (ex: alertes erreur), on reste en pending_approval
    // L'admin pourra "force" via le bouton existant.
    return {
      status: 'recorded',
      approvalsCount,
      requiredCount: REQUIRED_APPROVALS_COUNT,
      autoPublished: false,
    }
  }

  return {
    status: 'recorded',
    approvalsCount,
    requiredCount: REQUIRED_APPROVALS_COUNT,
    autoPublished: false,
  }
}
