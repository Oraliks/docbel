import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { compareBaremeVersions, comparisonSnapshot } from './compareBaremeVersions'
import type { BaremeComparisonSnapshot } from './types'

export type ComparisonReviewResult =
  | { status: 'reviewed' | 'refreshed'; snapshot: BaremeComparisonSnapshot }
  | { status: 'error'; reason: 'not_found' | 'unavailable' | 'stale' | 'not_draft'; message: string }

/** Enregistre une revue explicite, liée à la paire et aux données normalisées. */
export function recordBaremeComparisonReview(fileId: string, actorEmail: string): Promise<ComparisonReviewResult> {
  return writeComparison(fileId, actorEmail, false)
}

/** Renouvellement explicite d'un brouillon ; l'ancienne paire reste au journal. */
export function refreshBaremeComparison(fileId: string, actorEmail: string): Promise<ComparisonReviewResult> {
  return writeComparison(fileId, actorEmail, true)
}

async function writeComparison(fileId: string, actorEmail: string, refresh: boolean): Promise<ComparisonReviewResult> {
  const file = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: fileId }, select: { id: true, fileType: true, status: true, diagnostics: true },
  }))
  if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable' }
  const snapshot = readSnapshot(file.diagnostics)
  if (!snapshot || snapshot.state === 'reference_unavailable') {
    return { status: 'error', reason: 'unavailable', message: 'La comparaison historique n’est pas disponible pour cet import.' }
  }
  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return { status: 'error', reason: 'not_draft', message: 'Seule la comparaison d’un brouillon peut être renouvelée ou examinée.' }
  }
  const diff = await compareBaremeVersions(fileId, refresh ? undefined : snapshot.reference?.id ?? null)
  if (diff.state === 'reference_unavailable') return { status: 'error', reason: 'unavailable', message: 'Référence de comparaison indisponible.' }
  const nextSnapshot = refresh ? comparisonSnapshot(diff) : snapshot
  if (refresh) {
    // Même paire : le renouvellement doit quand même invalider la revue précédente.
    nextSnapshot.computedAt = new Date(Math.max(Date.now(), Date.parse(snapshot.computedAt) + 1)).toISOString()
  }
  try {
    return await withDbRetry(() => prisma.$transaction(async (tx): Promise<ComparisonReviewResult> => {
      const current = await tx.baremeFile.findUnique({ where: { id: fileId }, select: { status: true, diagnostics: true } })
      const published = await tx.baremeFile.findFirst({
        where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
        orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
      })
      const changed = !current || current.status !== file.status || JSON.stringify(current.diagnostics) !== JSON.stringify(file.diagnostics)
      const stale = nextSnapshot.candidate.dataRevision !== diff.candidateDataRevision
        || (nextSnapshot.reference?.dataRevision ?? null) !== diff.referenceDataRevision
        || (nextSnapshot.reference?.id ?? null) !== (published?.id ?? null)
      if (changed || stale) return staleResult()
      if (refresh) {
        const diagnostics = JSON.parse(JSON.stringify({ ...file.diagnostics as Prisma.JsonObject, comparison: nextSnapshot })) as Prisma.InputJsonValue
        await tx.baremeFile.update({ where: { id: fileId }, data: { diagnostics } })
      }
      // Preuve obligatoire : l'échec du journal annule aussi le renouvellement.
      await tx.baremePublicationLog.create({ data: {
        fileId, action: refresh ? 'comparison_refreshed' : 'comparison_reviewed', actorEmail,
        details: JSON.parse(JSON.stringify({ comparison: nextSnapshot, ...(refresh ? { previousComparison: snapshot } : {}) })) as Prisma.InputJsonValue,
      } })
      return { status: refresh ? 'refreshed' : 'reviewed', snapshot: nextSnapshot }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return staleResult()
    throw error
  }
}

function staleResult(): ComparisonReviewResult {
  return { status: 'error', reason: 'stale', message: 'La référence publiée ou les données comparées ont changé : renouveler la comparaison puis refaire la revue.' }
}

export function readSnapshot(diagnostics: unknown): BaremeComparisonSnapshot | null {
  const snapshot = (diagnostics as { comparison?: BaremeComparisonSnapshot } | null)?.comparison
  return snapshot?.version === 1 && snapshot.candidate?.id ? snapshot : null
}
