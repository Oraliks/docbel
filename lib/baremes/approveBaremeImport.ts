import { Prisma } from '@prisma/client'
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
  | { status: 'recorded'; approvalsCount: number; requiredCount: number; autoPublished: boolean; publicationError?: string }
  | { status: 'already_approved'; approvalsCount: number }
  | { status: 'error'; message: string }

type RecordedApproval = {
  status: 'recorded'
  approvalsCount: number
  previousStatus: string
  requiresApproval: boolean
  submittedForApproval: boolean
  alreadyApproved: boolean
}

class ApprovalStateChangedError extends Error {}

/**
 * Enregistre une approbation distincte puis relit le total dans la même
 * transaction. La publication éventuelle conserve son propre verrou
 * serializable, ce qui rend les doubles clics et les approbations simultanées
 * inoffensifs.
 */
export async function approveBaremeImport(
  fileId: string,
  options: ApproveBaremeOptions
): Promise<ApproveResult> {
  let result: RecordedApproval | Extract<ApproveResult, { status: 'already_approved' | 'error' }>
  try {
    result = await withDbRetry(() =>
      prisma.$transaction(
        async (tx): Promise<RecordedApproval | Extract<ApproveResult, { status: 'already_approved' | 'error' }>> => {
          const file = await tx.baremeFile.findUnique({
            where: { id: fileId },
            select: { status: true, requiresApproval: true },
          })
          if (!file) return { status: 'error', message: 'Import introuvable' }
          if (file.status !== 'draft' && file.status !== 'pending_approval') {
            return { status: 'error', message: `Approbation impossible — statut actuel: ${file.status}` }
          }

          const existing = await tx.baremeApproval.findUnique({
            where: { fileId_approverEmail: { fileId, approverEmail: options.approverEmail } },
            select: { id: true },
          })
          if (existing) {
            const approvalsCount = await tx.baremeApproval.count({ where: { fileId } })
            if (file.requiresApproval && approvalsCount >= REQUIRED_APPROVALS_COUNT) {
              // Réessai après revue/renouvellement, sans créer une troisième approbation.
              return { status: 'recorded', approvalsCount, previousStatus: file.status, requiresApproval: true, submittedForApproval: false, alreadyApproved: true }
            }
            return { status: 'already_approved', approvalsCount }
          }

          await tx.baremeApproval.create({
            data: {
              fileId,
              approverEmail: options.approverEmail,
              approverName: options.approverName ?? null,
              comment: options.comment ?? null,
            },
          })
          const approvalsCount = await tx.baremeApproval.count({ where: { fileId } })
          const submittedForApproval =
            file.requiresApproval &&
            file.status === 'draft' &&
            approvalsCount < REQUIRED_APPROVALS_COUNT
          if (submittedForApproval) {
            const transitioned = await tx.baremeFile.updateMany({
              where: { id: fileId, status: 'draft' },
              data: { status: 'pending_approval' },
            })
            if (transitioned.count !== 1) {
              // L'approbation nouvellement créée doit aussi être annulée si le
              // draft a quitté son état attendu.
              throw new ApprovalStateChangedError()
            }
          }
          return {
            status: 'recorded',
            approvalsCount,
            previousStatus: file.status,
            requiresApproval: file.requiresApproval,
            submittedForApproval,
            alreadyApproved: false,
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 30_000,
        }
      )
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const approvalsCount = await withDbRetry(() => prisma.baremeApproval.count({ where: { fileId } }))
      return { status: 'already_approved', approvalsCount }
    }
    if (
      error instanceof ApprovalStateChangedError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
    ) {
      return { status: 'error', message: "Une autre approbation est en cours — actualiser puis réessayer." }
    }
    throw error
  }

  if (result.status !== 'recorded') return result

  if (!result.alreadyApproved) await logPublicationEvent({
    fileId,
    action: 'approved',
    fromStatus: result.previousStatus,
    toStatus: result.previousStatus,
    actorEmail: options.approverEmail,
    details: { approvalsCount: result.approvalsCount, requiredCount: REQUIRED_APPROVALS_COUNT },
  })
  if (result.submittedForApproval) {
    await logPublicationEvent({
      fileId,
      action: 'submitted_for_approval',
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      actorEmail: options.approverEmail,
    })
  }

  if (!result.requiresApproval || result.approvalsCount < REQUIRED_APPROVALS_COUNT) {
    return {
      status: 'recorded',
      approvalsCount: result.approvalsCount,
      requiredCount: REQUIRED_APPROVALS_COUNT,
      autoPublished: false,
    }
  }

  const published = await publishBaremeImport(fileId, {
    publishedBy: options.approverEmail,
    bypassApprovalCheck: true,
  })
  return {
    status: 'recorded',
    approvalsCount: result.approvalsCount,
    requiredCount: REQUIRED_APPROVALS_COUNT,
    autoPublished: published.status === 'published',
    ...(published.status === 'error' ? { publicationError: published.message } : {}),
  }
}
