import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { getBlob, isPrivateBlobPath } from '@/lib/storage/blob-storage'
import { sha256 } from './hash'
import { readCurrentDataRevision, readSnapshot } from './comparisonReview'

type ResumeResult = { status: 'resumed' } | { status: 'error'; reason: 'not_found' | 'not_rejected' | 'unavailable' | 'changed'; message: string }

/** Reprend uniquement un rejeté jamais publié, après preuve de sa source exacte. */
export async function resumeRejectedBaremeImport(fileId: string, actorEmail: string, reason: string): Promise<ResumeResult> {
  const file = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: fileId },
    select: { id: true, status: true, fileType: true, fileHash: true, fileSize: true, filePath: true, publishedAt: true, diagnostics: true, alerts: true },
  }))
  if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable.' }
  if (file.status !== 'rejected' || file.publishedAt) {
    return { status: 'error', reason: 'not_rejected', message: 'Seul un import rejeté qui n’a jamais été publié peut être repris.' }
  }
  const snapshot = readSnapshot(file.diagnostics)
  if (file.fileType !== 'onem-rates' || !file.fileHash || !file.fileSize || file.fileSize <= 0 || !isPrivateBlobPath(file.filePath)
    || !snapshot || snapshot.candidate.id !== file.id || !Number.isFinite(Date.parse(snapshot.computedAt))) {
    return { status: 'error', reason: 'unavailable', message: 'La source privée exacte et la comparaison d’origine doivent être disponibles pour reprendre cet import.' }
  }

  let bytes: Buffer | null
  try { bytes = await getBlob(file.filePath) } catch { bytes = null }
  if (!bytes || bytes.length !== file.fileSize || sha256(bytes) !== file.fileHash) {
    return { status: 'error', reason: 'unavailable', message: 'Le fichier source privé ne correspond plus à l’empreinte de cet import.' }
  }

  try {
    return await withDbRetry(() => prisma.$transaction(async (tx): Promise<ResumeResult> => {
      const current = await tx.baremeFile.findUnique({
        where: { id: fileId },
        select: { id: true, status: true, fileType: true, fileHash: true, fileSize: true, filePath: true, publishedAt: true, diagnostics: true, alerts: true },
      })
      if (!current) return { status: 'error', reason: 'not_found', message: 'Import introuvable.' }
      if (current.status !== 'rejected' || current.publishedAt) {
        return { status: 'error', reason: 'not_rejected', message: 'Le statut a changé. Actualisez la fiche avant de réessayer.' }
      }
      if (current.fileType !== file.fileType || current.filePath !== file.filePath || current.fileHash !== file.fileHash
        || current.fileSize !== file.fileSize || JSON.stringify(current.diagnostics) !== JSON.stringify(file.diagnostics)
        || JSON.stringify(current.alerts) !== JSON.stringify(file.alerts)) {
        return { status: 'error', reason: 'changed', message: 'Les données ou la comparaison ont changé pendant la reprise.' }
      }
      const previouslyPublished = await tx.baremePublicationLog.findFirst({
        where: { fileId, action: { in: ['published', 'force_published', 'rollback', 'revoked', 'archived'] } },
        select: { id: true },
      })
      if (previouslyPublished) return { status: 'error', reason: 'not_rejected', message: 'Cet import a déjà participé à une publication et ne peut pas être repris par ce parcours.' }
      const previousSnapshot = readSnapshot(current.diagnostics)
      if (!previousSnapshot || (await readCurrentDataRevision(tx, fileId)) !== previousSnapshot.candidate.dataRevision) {
        return { status: 'error', reason: 'changed', message: 'Les montants normalisés ne correspondent plus à la comparaison d’origine.' }
      }

      const approvalCount = await tx.baremeApproval.count({ where: { fileId } })
      if (approvalCount > 1000) {
        return { status: 'error', reason: 'unavailable', message: 'Trop d’approbations historiques pour une reprise automatique sûre.' }
      }
      const approvals = await tx.baremeApproval.findMany({
        where: { fileId }, orderBy: { createdAt: 'asc' }, take: 1000,
        select: { id: true, approverEmail: true, approverName: true, comment: true, createdAt: true },
      })
      if (approvals.length !== approvalCount) {
        return { status: 'error', reason: 'changed', message: 'La liste des approbations a changé pendant la reprise.' }
      }
      const historicalDecisionCount = await tx.baremePublicationLog.count({
        where: { fileId, action: { in: ['comparison_reviewed', 'comparison_change_confirmed'] } },
      })
      const diagnostics = { ...(current.diagnostics as Record<string, unknown>) }
      delete diagnostics.comparison
      diagnostics.comparisonPending = { version: 1, fileHash: file.fileHash, fileSize: file.fileSize }
      diagnostics.comparisonAlerts = []
      const currentAlerts = Array.isArray(current.alerts) ? current.alerts as Array<Record<string, unknown>> : []
      const structuralAlerts = Array.isArray(diagnostics.structuralAlerts)
        ? diagnostics.structuralAlerts
        : currentAlerts.filter((alert) => alert.kind !== 'anomaly')
      const previousAlerts = current.alerts
      const updated = await tx.baremeFile.updateMany({
        where: { id: fileId, status: 'rejected', fileType: 'onem-rates', publishedAt: null, fileHash: file.fileHash, fileSize: file.fileSize, filePath: file.filePath },
        data: { status: 'draft', diagnostics: diagnostics as Prisma.InputJsonValue, alerts: structuralAlerts as Prisma.InputJsonValue },
      })
      if (updated.count !== 1) return { status: 'error', reason: 'changed', message: 'Le statut a changé. Actualisez la fiche avant de réessayer.' }
      if (approvals.length) await tx.baremeApproval.deleteMany({ where: { fileId } })
      await tx.baremePublicationLog.create({
        data: {
          fileId, action: 'resumed', fromStatus: 'rejected', toStatus: 'draft', actorEmail,
          details: {
            reason: reason.trim(), fileHash: file.fileHash, fileSize: file.fileSize,
            previousComparison: previousSnapshot, previousAlerts,
            comparisonInvalidated: true, comparisonPending: true,
            invalidatedReviewOrConfirmationCount: historicalDecisionCount,
            invalidatedApprovals: approvals.map((approval) => ({ ...approval, createdAt: approval.createdAt.toISOString() })),
          } as unknown as Prisma.InputJsonValue,
        },
      })
      return { status: 'resumed' }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return { status: 'error', reason: 'changed', message: 'Une autre action a modifié cet import. Actualisez la fiche.' }
    }
    throw error
  }
}
