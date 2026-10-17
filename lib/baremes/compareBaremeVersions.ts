import { createHash } from 'node:crypto'
import { prisma, withDbRetry } from '@/lib/prisma'
import type { BaremeAlert, BaremeComparableAmount, BaremeComparisonFileRef, BaremeComparisonSnapshot, BaremeDiff, BaremeDiffAttribute, BaremeDiffChange } from './types'

const ANOMALY_THRESHOLD_PCT = 8
const ANOMALY_ERROR_THRESHOLD_PCT = 50
const AMOUNT_BATCH_SIZE = 500

/** Compare exhaustivement deux imports de la même famille, sans écraser les collisions. */
export async function compareBaremeVersions(newFileId: string, previousFileId?: string | null): Promise<BaremeDiff> {
  const candidate = await withDbRetry(() => prisma.baremeFile.findUnique({
    where: { id: newFileId },
    select: { id: true, name: true, status: true, fileType: true, validFrom: true },
  }))
  if (!candidate) throw new Error('Import introuvable')
  const validFrom = candidate.validFrom
  const resolvedPrevious = previousFileId !== undefined
    ? previousFileId === null ? null : await withDbRetry(() => prisma.baremeFile.findUnique({ where: { id: previousFileId }, select: { id: true, name: true, status: true, fileType: true, validFrom: true } }))
    : validFrom
      ? await withDbRetry(() => prisma.baremeFile.findFirst({
          where: { status: 'published', fileType: candidate.fileType, NOT: { id: newFileId }, validFrom: { lte: validFrom } },
          orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
          select: { id: true, name: true, status: true, fileType: true, validFrom: true },
        }))
      : null
  const [current, previous] = await Promise.all([
    fetchComparableAmounts(newFileId),
    resolvedPrevious && resolvedPrevious.fileType === candidate.fileType ? fetchComparableAmounts(resolvedPrevious.id) : Promise.resolve([]),
  ])
  const candidateRef = toFileRef(candidate, dataRevision(current))
  const referenceRef = resolvedPrevious && resolvedPrevious.fileType === candidate.fileType ? toFileRef(resolvedPrevious, dataRevision(previous)) : null
  if (!candidate.validFrom && !previousFileId) return emptyDiff('reference_unavailable', candidateRef)
  if (!referenceRef) return emptyDiff('first_import', candidateRef)
  return buildBaremeDiff(current, previous, candidateRef, referenceRef)
}

async function fetchComparableAmounts(fileId: string): Promise<BaremeComparableAmount[]> {
  const rows: BaremeComparableAmount[] = []
  let cursor: string | undefined
  do {
    const page = await withDbRetry(() => prisma.baremeAmount.findMany({
      where: { fileId }, cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0, take: AMOUNT_BATCH_SIZE, orderBy: { id: 'asc' },
      select: { id: true, sourceSheet: true, category: true, allocationCode: true, salaryCode: true, article: true, labelFr: true, labelNl: true, unit: true, amount: true, minDailySalary: true, maxDailySalary: true, comparisonKey: true, rawData: true },
    }))
    rows.push(...page.map((a) => ({
      ...a,
      amount: decimalToNumber(a.amount), minDailySalary: a.minDailySalary ? decimalToNumber(a.minDailySalary) : null,
      maxDailySalary: a.maxDailySalary ? decimalToNumber(a.maxDailySalary) : null,
      trace: ((((a.rawData ?? {}) as Record<string, unknown>).trace as BaremeComparableAmount['trace']) ?? null),
    })))
    cursor = page.at(-1)?.id
    if (page.length < AMOUNT_BATCH_SIZE) break
  } while (cursor)
  return rows
}

function decimalToNumber(decimal: { toNumber(): number } | number) { return typeof decimal === 'number' ? decimal : decimal.toNumber() }
function toFileRef(file: { id: string; name: string; status: string; fileType: string; validFrom: Date | null }, dataRevision: string): BaremeComparisonFileRef { return { ...file, validFrom: file.validFrom?.toISOString() ?? null, dataRevision } }
function emptyDiff(state: 'first_import' | 'reference_unavailable', candidate: BaremeComparisonFileRef): BaremeDiff {
  return { changes: [], previousFileId: null, newFileId: candidate.id, state, candidate, reference: null, candidateDataRevision: candidate.dataRevision, referenceDataRevision: null, countsByType: { modified: 0, unchanged: 0, added: 0, disappeared: 0, ambiguous: 0 }, countsByChange: { amount: 0, attributes: 0 } }
}

/** Exporté pour tester des fixtures sans base de données. */
export function buildBaremeDiff(current: BaremeComparableAmount[], previous: BaremeComparableAmount[], candidate: BaremeComparisonFileRef, reference: BaremeComparisonFileRef): BaremeDiff {
  const oldByKey = groupByKey(previous)
  const currentByKey = groupByKey(current)
  const changes: BaremeDiffChange[] = []
  for (const key of [...new Set([...oldByKey.keys(), ...currentByKey.keys()])].sort()) {
    const oldRows = oldByKey.get(key) ?? []
    const currentRows = currentByKey.get(key) ?? []
    if (oldRows.length > 1 || currentRows.length > 1) {
      for (const row of oldRows) changes.push(ambiguousChange(key, row, undefined))
      for (const row of currentRows) changes.push(ambiguousChange(key, undefined, row))
      continue
    }
    const old = oldRows[0]
    const next = currentRows[0]
    if (!old && next) { changes.push({ type: 'added', key, newValue: next.amount, category: next.category, sourceSheet: next.sourceSheet, current: next }); continue }
    if (old && !next) { changes.push({ type: 'disappeared', key, oldValue: old.amount, category: old.category, sourceSheet: old.sourceSheet, old }); continue }
    if (!old || !next) continue
    const changedAttributes = changedAttributeNames(old, next)
    const amountChanged = !numbersEqual(old.amount, next.amount)
    changes.push({ type: amountChanged || changedAttributes.length ? 'modified' : 'unchanged', key, oldValue: old.amount, newValue: next.amount, category: next.category, sourceSheet: next.sourceSheet, old, current: next, amountChanged, changedAttributes })
  }
  const countsByType = { modified: 0, unchanged: 0, added: 0, disappeared: 0, ambiguous: 0 }
  let amount = 0; let attributes = 0
  for (const change of changes) { countsByType[change.type]++; if (change.amountChanged) amount++; if (change.changedAttributes?.length) attributes++ }
  return { changes, previousFileId: reference.id, newFileId: candidate.id, state: 'computed', candidate, reference, candidateDataRevision: candidate.dataRevision, referenceDataRevision: reference.dataRevision, countsByType, countsByChange: { amount, attributes } }
}

export function comparisonSnapshot(diff: BaremeDiff): BaremeComparisonSnapshot { return { version: 1, state: diff.state, candidate: diff.candidate, reference: diff.reference, computedAt: new Date().toISOString() } }
function groupByKey(rows: BaremeComparableAmount[]) { const grouped = new Map<string, BaremeComparableAmount[]>(); for (const row of rows) grouped.set(row.comparisonKey, [...(grouped.get(row.comparisonKey) ?? []), row]); return grouped }
function ambiguousChange(key: string, old: BaremeComparableAmount | undefined, current: BaremeComparableAmount | undefined): BaremeDiffChange { return { type: 'ambiguous', key, oldValue: old?.amount, newValue: current?.amount, category: current?.category ?? old?.category ?? null, sourceSheet: current?.sourceSheet ?? old?.sourceSheet ?? null, old, current, warning: 'ambiguous_identity' } }
function changedAttributeNames(old: BaremeComparableAmount, current: BaremeComparableAmount): BaremeDiffAttribute[] { const values: Array<[BaremeDiffAttribute, unknown, unknown]> = [['unit', old.unit, current.unit], ['minDailySalary', old.minDailySalary, current.minDailySalary], ['maxDailySalary', old.maxDailySalary, current.maxDailySalary], ['article', old.article, current.article], ['allocationCode', old.allocationCode, current.allocationCode], ['salaryCode', old.salaryCode, current.salaryCode]]; return values.filter(([, a, b]) => !sameNullable(a, b)).map(([name]) => name) }
function sameNullable(a: unknown, b: unknown) { return a === b || (typeof a === 'number' && typeof b === 'number' && numbersEqual(a, b)) }
function numbersEqual(a: number, b: number) { return Math.abs(a - b) < 0.00000001 }
function dataRevision(rows: BaremeComparableAmount[]) {
  const canonical = [...rows].sort((a, b) => a.id.localeCompare(b.id)).map((row) => ({
    sourceSheet: row.sourceSheet, category: row.category, allocationCode: row.allocationCode,
    salaryCode: row.salaryCode, article: row.article, labelFr: row.labelFr, labelNl: row.labelNl,
    unit: row.unit, amount: row.amount, minDailySalary: row.minDailySalary,
    maxDailySalary: row.maxDailySalary, comparisonKey: row.comparisonKey,
  }))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

type AmountChange = BaremeDiffChange & { oldValue: number; newValue: number }
export function detectAnomaliesFromDiff(diff: BaremeDiff): BaremeAlert[] {
  const suspects: AmountChange[] = []; const critical: AmountChange[] = []
  for (const change of diff.changes) {
    if (change.type !== 'modified' || !change.amountChanged || change.oldValue === undefined || change.newValue === undefined || change.oldValue === 0) continue
    const pct = Math.abs((change.newValue - change.oldValue) / change.oldValue) * 100
    if (pct >= ANOMALY_ERROR_THRESHOLD_PCT) critical.push(change as AmountChange); else if (pct >= ANOMALY_THRESHOLD_PCT) suspects.push(change as AmountChange)
  }
  const alerts: BaremeAlert[] = []
  if (critical.length) alerts.push({ level: 'error', message: `${critical.length} variation(s) >${ANOMALY_ERROR_THRESHOLD_PCT}% détectée(s) — ${critical.slice(0, 5).map(formatChange).join(', ')}${critical.length > 5 ? '…' : ''}` })
  if (suspects.length) alerts.push({ level: 'warn', message: `${suspects.length} variation(s) >${ANOMALY_THRESHOLD_PCT}% à vérifier — ${suspects.slice(0, 5).map((c) => `${formatChange(c)}, ${String(pctDelta(c))}%`).join(', ')}${suspects.length > 5 ? '…' : ''}` })
  return alerts
}
function formatChange(c: AmountChange) { return `${c.key} (${String(c.oldValue)} → ${String(c.newValue)})` }
function pctDelta(c: AmountChange) { return ((c.newValue - c.oldValue) / c.oldValue) * 100 }
export const ANOMALY_THRESHOLDS = { warn: ANOMALY_THRESHOLD_PCT, error: ANOMALY_ERROR_THRESHOLD_PCT }
