import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { compareBaremeVersions } from './compareBaremeVersions'
import { sameComparisonSnapshot } from './comparisonIdentity'
import { readSnapshot } from './comparisonReview'
import { getBlob, isPrivateBlobPath } from '@/lib/storage/blob-storage'
import { sha256 } from './hash'
import type { BaremeAlert, BaremeComparisonSnapshot, BaremeProblemEvidence } from './types'

type ConfirmationResult =
  | { status: 'confirmed'; problemId: string; confirmedKeys: string[] }
  | { status: 'error'; reason: 'not_found' | 'not_actionable' | 'invalid_reason' | 'stale' | 'source_unavailable'; message: string }

/**
 * Confirme un groupe de variations uniquement si l'identité, le contexte,
 * les cellules source et la révision sont encore vérifiables côté serveur.
 */
export async function confirmBaremeChange(
  fileId: string,
  actorEmail: string,
  input: { comparison: BaremeComparisonSnapshot; problemId: string; reason: string }
): Promise<ConfirmationResult> {
  const reason = input.reason.trim()
  if (reason.length < 20 || reason.length > 2000) {
    return { status: 'error', reason: 'invalid_reason', message: 'La justification doit contenir entre 20 et 2 000 caractères.' }
  }

  const file = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: fileId },
    select: { id: true, status: true, fileType: true, diagnostics: true, fileHash: true, fileSize: true, filePath: true },
  }))
  if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable.' }
  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return { status: 'error', reason: 'not_actionable', message: 'Seul un brouillon peut recevoir cette décision.' }
  }

  const snapshot = readSnapshot(file.diagnostics)
  if (!snapshot || !sameComparisonSnapshot(input.comparison, snapshot) || snapshot.state !== 'computed') {
    return { status: 'error', reason: 'stale', message: 'La comparaison a changé. Actualisez-la avant de confirmer.' }
  }

  const diagnostics = file.diagnostics as { comparisonAlerts?: BaremeAlert[] } | null
  const alert = diagnostics?.comparisonAlerts?.find((entry) => entry.problem?.id === input.problemId)
  const problem = alert?.problem
  const keys = problem?.affectedKeys ? [...new Set(problem.affectedKeys)].sort() : []
  if (!problem || problem.category !== 'anomaly' || problem.publicationEffect !== 'review'
    || !problem.allowedActions.includes('confirm_change') || problem.resolutionState !== 'open'
    || keys.length === 0 || keys.length !== problem.affectedCount) {
    return { status: 'error', reason: 'not_actionable', message: 'Ce constat ne peut pas être confirmé par une décision humaine.' }
  }

  if (!file.fileHash || !file.fileSize || !isPrivateBlobPath(file.filePath)) {
    return { status: 'error', reason: 'source_unavailable', message: 'Le fichier original vérifiable est requis.' }
  }
  try {
    const bytes = await getBlob(file.filePath)
    if (!bytes || bytes.byteLength !== file.fileSize || sha256(bytes) !== file.fileHash) {
      return { status: 'error', reason: 'source_unavailable', message: 'Le fichier original ne correspond plus à sa provenance enregistrée.' }
    }
  } catch {
    return { status: 'error', reason: 'source_unavailable', message: 'Le fichier original est momentanément indisponible.' }
  }

  const diff = await compareBaremeVersions(fileId, snapshot.reference?.id ?? null)
  if (diff.state !== 'computed' || diff.candidateDataRevision !== snapshot.candidate.dataRevision
    || diff.referenceDataRevision !== snapshot.reference?.dataRevision) {
    return { status: 'error', reason: 'stale', message: 'Les données comparées ont changé. Recalculez la comparaison.' }
  }

  const changes = keys.map((key) => diff.changes.find((change) => change.key === key))
  if (changes.some((change) => !change || !isConfirmableChange(change))) {
    return { status: 'error', reason: 'not_actionable', message: 'Une des lignes n’a plus une identité et une provenance suffisantes pour être confirmée.' }
  }
  const evidence = changes.map((change) => evidenceForChange(change!))
  const currentPublished = await withDbRetry(() => prisma.baremeFile.findFirst({
    where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
    orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
    select: { id: true },
  }))
  if ((snapshot.reference?.id ?? null) !== (currentPublished?.id ?? null)) {
    return { status: 'error', reason: 'stale', message: 'La référence publiée a changé. Recalculez la comparaison.' }
  }

  try {
    return await withDbRetry(() => prisma.$transaction(async (tx) => {
      const current = await tx.baremeFile.findUnique({
        where: { id: fileId }, select: { status: true, diagnostics: true, fileHash: true, fileSize: true, filePath: true },
      })
      const published = await tx.baremeFile.findFirst({
        where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
        orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
      })
      const currentSnapshot = readSnapshot(current?.diagnostics)
      if (!current || current.status !== file.status || !currentSnapshot
        || !sameComparisonSnapshot(currentSnapshot, snapshot)
        || current.fileHash !== file.fileHash || current.fileSize !== file.fileSize || current.filePath !== file.filePath
        || (published?.id ?? null) !== (snapshot.reference?.id ?? null)) {
        return { status: 'error' as const, reason: 'stale' as const, message: 'La source ou la référence a changé. Actualisez et recommencez.' }
      }

      const nextDiagnostics = JSON.parse(JSON.stringify(current.diagnostics)) as { comparisonAlerts?: BaremeAlert[] }
      const currentIssue = nextDiagnostics.comparisonAlerts?.find((entry) => entry.problem?.id === input.problemId)
      if (!currentIssue?.problem || currentIssue.problem.category !== 'anomaly'
        || currentIssue.problem.publicationEffect !== 'review'
        || !currentIssue.problem.allowedActions.includes('confirm_change')
        || currentIssue.problem.resolutionState !== 'open'
        || JSON.stringify([...(currentIssue.problem.affectedKeys ?? [])].sort()) !== JSON.stringify(keys)) {
        return { status: 'error' as const, reason: 'stale' as const, message: 'Les variations concernées ont changé. Actualisez et recommencez.' }
      }
      currentIssue.problem.resolutionState = 'confirmed'
      currentIssue.problem.resolution = {
        actorEmail,
        confirmedAt: new Date().toISOString(),
        reason,
        reviewedKeys: keys,
        comparison: snapshot,
      }
      await tx.baremeFile.update({
        where: { id: fileId },
        data: { diagnostics: nextDiagnostics as Prisma.InputJsonValue },
      })
      await tx.baremePublicationLog.create({
        data: {
          fileId,
          action: 'comparison_change_confirmed',
          actorEmail,
          details: JSON.parse(JSON.stringify({
            version: 1, problemId: input.problemId, reason, reviewedKeys: keys,
            evidence, comparison: snapshot, candidateDataRevision: diff.candidateDataRevision,
            referenceDataRevision: diff.referenceDataRevision,
          })) as Prisma.InputJsonValue,
        },
      })
      return { status: 'confirmed' as const, problemId: input.problemId, confirmedKeys: keys }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return { status: 'error', reason: 'stale', message: 'Une autre décision est en cours. Actualisez avant de recommencer.' }
    }
    throw error
  }
}

function isConfirmableChange(change: import('./types').BaremeDiffChange): boolean {
  const old = change.old
  const current = change.current
  return change.type === 'modified' && change.amountChanged === true && !change.warning
    && change.oldValue !== undefined && change.newValue !== undefined
    && Boolean(old?.trace?.sourceCell && old.trace.rawValue !== undefined)
    && Boolean(current?.trace?.sourceCell && current.trace.rawValue !== undefined)
    && old?.category === current?.category && old?.unit === current?.unit && old?.article === current?.article
    && old?.minDailySalary === current?.minDailySalary && old?.maxDailySalary === current?.maxDailySalary
    && (old?.trace?.rate ?? null) === (current?.trace?.rate ?? null)
    && old?.comparisonKey === current?.comparisonKey
}

function evidenceForChange(change: import('./types').BaremeDiffChange): BaremeProblemEvidence {
  const old = change.old!
  const current = change.current!
  return {
    comparisonKey: change.key,
    oldValue: change.oldValue,
    newValue: change.newValue,
    oldSource: { sheet: old.sourceSheet, cell: old.trace!.sourceCell, rawValue: old.trace!.rawValue, unit: old.unit },
    newSource: { sheet: current.sourceSheet, cell: current.trace!.sourceCell, rawValue: current.trace!.rawValue, unit: current.unit },
  } as BaremeProblemEvidence
}
