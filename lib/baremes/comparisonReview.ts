import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { compareBaremeVersions, dataRevisionFromAmounts, detectAnomaliesFromDiff } from './compareBaremeVersions'
import { comparisonEnrichment } from './comparisonEnrichment'
import { sameComparisonSnapshot } from './comparisonIdentity'
import { getBlob, isPrivateBlobPath } from '@/lib/storage/blob-storage'
import { sha256 } from './hash'
import { baremePublicationDateStatus } from './calendar-date'
import type { BaremeComparisonSnapshot } from './types'

export type ComparisonReviewResult =
  | { status: 'reviewed' | 'refreshed'; snapshot: BaremeComparisonSnapshot }
  | { status: 'error'; reason: 'not_found' | 'unavailable' | 'stale' | 'not_draft' | 'date_unavailable'; message: string }

/** Enregistre une revue explicite, liée à la paire et aux données normalisées. */
export function recordBaremeComparisonReview(fileId: string, actorEmail: string, expected: BaremeComparisonSnapshot): Promise<ComparisonReviewResult> {
  return writeComparison(fileId, actorEmail, false, expected)
}

/** Renouvellement explicite d'un brouillon ; l'ancienne paire reste au journal. */
export function refreshBaremeComparison(fileId: string, actorEmail: string): Promise<ComparisonReviewResult> {
  return writeComparison(fileId, actorEmail, true)
}

async function writeComparison(fileId: string, actorEmail: string, refresh: boolean, expected?: BaremeComparisonSnapshot): Promise<ComparisonReviewResult> {
  const file = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: fileId }, select: { id: true, fileType: true, status: true, validFrom: true, diagnostics: true, summary: true, alerts: true, fileHash: true, fileSize: true, filePath: true },
  }))
  if (!file) return { status: 'error', reason: 'not_found', message: 'Import introuvable' }
  const snapshot = readSnapshot(file.diagnostics)
  const recovering = refresh && !snapshot && canResumeComparison(file)
  if ((!snapshot || snapshot.state === 'reference_unavailable') && !recovering) {
    return { status: 'error', reason: 'unavailable', message: 'La comparaison historique n’est pas disponible pour cet import.' }
  }
  if (file.status !== 'draft' && file.status !== 'pending_approval') {
    return { status: 'error', reason: 'not_draft', message: 'Seule la comparaison d’un brouillon peut être renouvelée ou examinée.' }
  }
  if (!refresh && baremePublicationDateStatus(file.validFrom) !== 'applicable') {
    return { status: 'error', reason: 'date_unavailable', message: 'La revue est disponible uniquement lorsque la date d’effet est applicable.' }
  }
  if (!refresh && (!expected || !snapshot || !sameComparisonSnapshot(expected, snapshot))) return staleResult()
  if (recovering) {
    // Le reçu identifie uniquement les nouveaux imports. Une archive ancienne
    // sans preuve n'est pas convertie en comparaison prétendument historique.
    try {
      const bytes = await getBlob(file.filePath)
      if (!bytes || bytes.length !== file.fileSize || sha256(bytes) !== file.fileHash) return sourceUnavailable()
    } catch { return sourceUnavailable() }
  }
  const diff = await compareBaremeVersions(fileId, refresh ? undefined : snapshot?.reference?.id ?? null)
  if (diff.state === 'reference_unavailable') return { status: 'error', reason: 'unavailable', message: 'Référence de comparaison indisponible.' }
  // Les imports antérieurs au marquage conservent leurs anciennes alertes
  // comparatives sans kind. Les identifier depuis leur ancienne paire exacte.
  const previousAlerts = refresh && snapshot && !Array.isArray((file.diagnostics as Prisma.JsonObject | null)?.structuralAlerts)
    ? detectAnomaliesFromDiff(await compareBaremeVersions(fileId, snapshot.reference?.id ?? null)) : []
  const enriched = refresh ? comparisonEnrichment(diff, file, previousAlerts) : null
  const nextSnapshot = enriched?.diagnostics.comparison ?? snapshot!
  if (refresh) {
    // Même paire : le renouvellement doit quand même invalider la revue précédente.
    nextSnapshot.computedAt = new Date(Math.max(Date.now(), snapshot ? Date.parse(snapshot.computedAt) + 1 : 0)).toISOString()
  }
  try {
    return await withDbRetry(() => prisma.$transaction(async (tx): Promise<ComparisonReviewResult> => {
      const current = await tx.baremeFile.findUnique({ where: { id: fileId }, select: { status: true, diagnostics: true, alerts: true, summary: true, fileHash: true, fileSize: true, filePath: true } })
      const published = await tx.baremeFile.findFirst({
        where: { status: 'published', fileType: file.fileType, NOT: { id: fileId } },
        orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }], select: { id: true },
      })
      const [candidateRevision, referenceRevision] = await Promise.all([
        readCurrentDataRevision(tx, fileId),
        published ? readCurrentDataRevision(tx, published.id) : Promise.resolve(null),
      ])
      const changed = !current || current.status !== file.status
        || current.filePath !== file.filePath || current.fileHash !== file.fileHash || current.fileSize !== file.fileSize
        || JSON.stringify(current.diagnostics) !== JSON.stringify(file.diagnostics)
        || JSON.stringify(current.alerts) !== JSON.stringify(file.alerts) || JSON.stringify(current.summary) !== JSON.stringify(file.summary)
      const stale = nextSnapshot.candidate.dataRevision !== diff.candidateDataRevision
        || (nextSnapshot.reference?.dataRevision ?? null) !== diff.referenceDataRevision
        || (nextSnapshot.reference?.id ?? null) !== (published?.id ?? null)
        || candidateRevision !== diff.candidateDataRevision
        || referenceRevision !== diff.referenceDataRevision
      if (changed || stale) return staleResult()
      const invalidatedApprovals = refresh
        ? await tx.baremeApproval.findMany({
            where: { fileId }, orderBy: { createdAt: 'asc' }, take: 100,
            select: { approverEmail: true, approverName: true, comment: true, createdAt: true },
          })
        : []
      if (enriched) {
        await tx.baremeFile.update({ where: { id: fileId }, data: {
          diagnostics: JSON.parse(JSON.stringify(enriched.diagnostics)) as Prisma.InputJsonValue,
          alerts: JSON.parse(JSON.stringify(enriched.alerts)) as Prisma.InputJsonValue,
          summary: JSON.parse(JSON.stringify(enriched.summary)) as Prisma.InputJsonValue,
        } })
      }
      if (invalidatedApprovals.length) {
        await tx.baremeApproval.deleteMany({ where: { fileId } })
      }
      // Preuve obligatoire : l'échec du journal annule aussi le renouvellement.
      await tx.baremePublicationLog.create({ data: {
        fileId, action: refresh ? 'comparison_refreshed' : 'comparison_reviewed', actorEmail,
        details: JSON.parse(JSON.stringify({ comparison: nextSnapshot, ...(refresh ? {
          previousComparison: snapshot, recoveredAfterImport: recovering,
          invalidatedApprovals: invalidatedApprovals.map((approval) => ({
            ...approval, createdAt: approval.createdAt.toISOString(),
          })),
        } : {}) })) as Prisma.InputJsonValue,
      } })
      return { status: refresh ? 'refreshed' : 'reviewed', snapshot: nextSnapshot }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 }))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return staleResult()
    throw error
  }
}

export async function readCurrentDataRevision(tx: Prisma.TransactionClient, fileId: string): Promise<string> {
  const rows: import('./types').BaremeComparableAmount[] = []
  let cursor: string | undefined
  do {
    const page = await tx.baremeAmount.findMany({
      where: { fileId }, cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0, take: 500, orderBy: { id: 'asc' },
      select: {
        id: true, sourceSheet: true, category: true, allocationCode: true, salaryCode: true,
        article: true, labelFr: true, labelNl: true, unit: true, amount: true,
        minDailySalary: true, maxDailySalary: true, comparisonKey: true, rawData: true,
      },
    })
    rows.push(...page.map((row) => ({
      ...row,
      amount: typeof row.amount === 'number' ? row.amount : row.amount.toNumber(),
      minDailySalary: row.minDailySalary == null ? null : typeof row.minDailySalary === 'number' ? row.minDailySalary : row.minDailySalary.toNumber(),
      maxDailySalary: row.maxDailySalary == null ? null : typeof row.maxDailySalary === 'number' ? row.maxDailySalary : row.maxDailySalary.toNumber(),
      trace: ((((row.rawData ?? {}) as Record<string, unknown>).trace as import('./types').BaremeComparableAmount['trace']) ?? null),
    })))
    cursor = page.at(-1)?.id
    if (page.length < 500) break
  } while (cursor)
  return dataRevisionFromAmounts(rows)
}

export function canResumeComparison(file: { diagnostics: unknown; fileHash: string | null; fileSize: number | null; filePath: string }): boolean {
  const pending = (file.diagnostics as { comparisonPending?: { version?: number; fileHash?: string; fileSize?: number } } | null)?.comparisonPending
  return pending?.version === 1 && Boolean(file.fileHash) && pending.fileHash === file.fileHash
    && Boolean(file.fileSize && file.fileSize > 0) && pending.fileSize === file.fileSize && isPrivateBlobPath(file.filePath)
}

function sourceUnavailable(): ComparisonReviewResult {
  return { status: 'error', reason: 'unavailable', message: 'La source privée exacte doit être vérifiée avant de reprendre cette comparaison.' }
}

function staleResult(): ComparisonReviewResult {
  return { status: 'error', reason: 'stale', message: 'La référence publiée ou les données comparées ont changé : renouveler la comparaison puis refaire la revue.' }
}

export function readSnapshot(diagnostics: unknown): BaremeComparisonSnapshot | null {
  const snapshot = (diagnostics as { comparison?: BaremeComparisonSnapshot } | null)?.comparison
  return snapshot?.version === 1 && snapshot.candidate?.id ? snapshot : null
}
