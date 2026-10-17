import { prisma, withDbRetry } from '@/lib/prisma'
import { compareBaremeVersions } from './compareBaremeVersions'
import { logPublicationEvent } from './publicationLog'
import type { BaremeComparisonSnapshot } from './types'

export type ComparisonReviewResult =
  | { status: 'reviewed'; snapshot: BaremeComparisonSnapshot }
  | { status: 'error'; reason: 'not_found' | 'unavailable' | 'stale'; message: string }

/** Enregistre une revue explicite, liée à la paire et aux données normalisées. */
export async function recordBaremeComparisonReview(fileId: string, actorEmail: string): Promise<ComparisonReviewResult> {
  const file = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: fileId }, select: { id: true, fileType: true, diagnostics: true },
  }))
  if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable' }
  const snapshot = readSnapshot(file.diagnostics)
  if (!snapshot || snapshot.state === 'reference_unavailable') {
    return { status: 'error', reason: 'unavailable', message: 'La comparaison historique n’est pas disponible pour cet import.' }
  }
  const diff = await compareBaremeVersions(fileId, snapshot.reference?.id)
  const currentPublished = await withDbRetry(() => prisma.baremeFile.findFirst({
    where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } }, orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
  }))
  const stale = snapshot.candidate.dataRevision !== diff.candidateDataRevision
    || snapshot.reference?.dataRevision !== diff.referenceDataRevision
    || (snapshot.reference?.id ?? null) !== (currentPublished?.id ?? null)
  if (stale) return { status: 'error', reason: 'stale', message: 'La référence publiée ou les données comparées ont changé : actualiser la revue avant publication.' }
  await logPublicationEvent({
    fileId,
    action: 'comparison_reviewed',
    actorEmail,
    details: { comparison: snapshot },
  })
  return { status: 'reviewed', snapshot }
}

export function readSnapshot(diagnostics: unknown): BaremeComparisonSnapshot | null {
  const snapshot = (diagnostics as { comparison?: BaremeComparisonSnapshot } | null)?.comparison
  return snapshot?.version === 1 && snapshot.candidate?.id ? snapshot : null
}
