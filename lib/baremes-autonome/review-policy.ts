import { Prisma } from '@prisma/client'
import { comparableUnit, digest } from './compare'
import type { Difference, Reading, ReadingIssue, Snapshot } from './types'
import type { DecisionView, ReviewKind, ReviewState, ReviewTask } from './review-types'
import { DOCUMENTARY_REASONS, INSTITUTIONAL_DOMAINS } from './decision-reasons'

const Decimal = Prisma.Decimal.clone({ precision: 80 })
export const REVIEW_POLICY = {
  version: 1,
  percent: '20',
  unitOverrides: {} as Record<string, string>,
  categoryOverrides: {} as Record<string, string>,
  documentaryReasons: DOCUMENTARY_REASONS,
  institutionalDomains: INSTITUTIONAL_DOMAINS,
}
export function brusselsToday(now = new Date()) {
  const fields = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((type) => fields.find((field) => field.type === type)!.value).join('-')
}
export function variation(before: string, after: string) {
  const a = new Decimal(before),
    b = new Decimal(after),
    delta = b.minus(a)
  return { delta: delta.toFixed(), percent: a.isZero() ? null : delta.times(100).div(a.abs()).toFixed() }
}
export function unusual(row: Difference) {
  const a = row.before,
    b = row.after
  if (!a || !b || a.valueKind || b.valueKind || comparableUnit(a) !== comparableUnit(b)) return false
  const old = new Decimal(a.value),
    next = new Decimal(b.value)
  if (old.eq(next)) return false
  if (old.isZero() || next.isZero()) return true
  const threshold =
    REVIEW_POLICY.categoryOverrides[a.category ?? ''] ??
    REVIEW_POLICY.unitOverrides[a.unit] ??
    REVIEW_POLICY.percent
  return next.minus(old).abs().times(100).gte(old.abs().times(threshold))
}
export function reviewTechnicalIssues(rows: Difference[], after: Reading): ReadingIssue[] {
  const issues: ReadingIssue[] = []
  for (const row of rows) {
    const a = row.before,
      b = row.after
    if (b && !b.valueKind && b.unit.startsWith('EUR') && new Decimal(b.value).isNegative())
      issues.push({
        code: 'NEGATIVE_MONETARY_VALUE',
        sheet: b.source.sheet,
        cell: b.source.cell,
        blocking: true,
      })
    if (a && b && (comparableUnit(a) !== comparableUnit(b) || a.category !== b.category))
      issues.push({
        code: 'INCOMPATIBLE_VALUE_CONTEXT',
        sheet: b.source.sheet,
        cell: b.source.cell,
        blocking: true,
      })
  }
  const absent = new Map(
    rows
      .filter((row) => row.kind === 'absent')
      .map((row) => [`${row.before!.source.sheet}!${row.before!.source.cell}`, row.key]),
  )
  const occupied = new Map(after.scope?.map((scope) => [scope.sheet, new Set(scope.occupiedCells ?? [])]))
  for (const row of rows) {
    const b = row.after
    if (!b?.source.formula) continue
    const references = b.source.formula
      .split(/("(?:[^"]|"")*")/g)
      .filter((_, index) => index % 2 === 0)
      .flatMap((part) => [
        ...part.matchAll(/((?:'(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_ .-]*)!)?(\$?[A-Z]{1,3})(\$?\d+)/g),
      ])
    if (
      references.some((match) => {
        const sheet = match[1]
          ? match[1].slice(0, -1).replace(/^'|'$/g, '').replaceAll("''", "'")
          : b.source.sheet
        const cell = match[2].replace('$', '') + match[3].replace('$', '')
        return absent.has(`${sheet}!${cell}`) && !occupied.get(sheet)?.has(cell)
      })
    )
      issues.push({ code: 'REFERENCED_REMOVAL', sheet: b.source.sheet, cell: b.source.cell, blocking: true })
  }
  return issues
}
function group(row: Difference, after: Reading) {
  const value = (row.after ?? row.before)!
  if (after.scope?.find((item) => item.sheet === value.source.sheet)?.state === 'absent')
    return `sheet:${value.source.sheet}`
  if (value.table === 'activation_allowances') return value.key.split('/').slice(0, 2).join('/')
  return `${value.source.sheet}:${value.table}`
}
function substantiveContext(row: Difference) {
  if (!row.before || !row.after || !row.contextChanged) return false
  const context = (value: NonNullable<Difference['before']>) => ({
    label: value.label,
    category: value.category,
    unit: comparableUnit(value),
    kind: value.valueKind ?? null,
    context: value.context
      .filter((part) => !/^date:\d{4}-\d{2}-\d{2}$/.test(part))
      .map((part) => part.replace(/^Montant indexé:/, 'Taux source:')),
  })
  return digest(context(row.before)) !== digest(context(row.after))
}
export function analyzeReview(
  before: Reading | null,
  after: Reading,
  rows: Difference[],
  snapshot: Omit<Snapshot, 'digest' | 'analysis'>,
  decisions: DecisionView[],
  technical: boolean,
  published: boolean,
  now = new Date(),
): ReviewState {
  const fingerprint = digest({
    snapshot,
    policy: REVIEW_POLICY,
    reader: after.parserVersion,
    identity: after.identityVersion ?? 1,
    rows,
  })
  const groups = new Map<string, { kind: ReviewKind; rows: Difference[] }>()
  for (const row of rows) {
    if (!before || row.kind === 'unchanged' || row.kind === 'added') continue
    const a = row.before,
      b = row.after
    const kind: ReviewKind | null =
      row.kind === 'absent'
        ? 'removal'
        : unusual(row)
          ? 'amount'
          : row.formulaChanged ||
              substantiveContext(row) ||
              (a?.valueKind && b?.valueKind && a.value !== b.value)
            ? 'context'
            : null
    if (!kind) continue
    // A shared cause is only a proposal for an explicit, exhaustive decision, never auto-acceptance.
    const key =
      kind === 'removal'
        ? `removal:${group(row, after)}`
        : kind === 'amount'
          ? digest({
              kind,
              sheet: b!.source.sheet,
              table: b!.table,
              category: b!.category,
              unit: comparableUnit(b!),
              context: b!.context.slice(0, 3),
              percent: variation(a!.value, b!.value).percent,
              zero: a!.value === '0' ? b!.value : null,
            })
          : `${kind}:${row.key}`
    const existing = groups.get(key)
    if (existing) existing.rows.push(row)
    else groups.set(key, { kind, rows: [row] })
  }
  const tasks: ReviewTask[] = [...groups.values()].map((item) => {
    const first = (item.rows[0].after ?? item.rows[0].before)!
    const keys = item.rows.map((row) => row.key).sort(),
      scopeDigest = digest(keys)
    const id = digest({ fingerprint, kind: item.kind, scopeDigest })
    const decision =
      decisions.find((value) => value.fingerprint === fingerprint && value.taskId === id) ?? null
    const evidence = after.scope?.find((value) => value.sheet === first.source.sheet)
    const admissible =
      !technical && (item.kind !== 'removal' || (!!evidence && evidence.state !== 'unreadable'))
    return {
      id,
      kind: item.kind,
      sheet: first.source.sheet,
      table: first.table,
      memberCount: keys.length,
      memberKeys: keys,
      scopeDigest,
      status: decision?.status === 'accepted' ? 'accepted' : 'pending',
      admissible,
      decision,
    }
  })
  const pending = tasks.filter((task) => task.status === 'pending').length
  const today = brusselsToday(now),
    date = after.effectiveFrom
  const future = !!date && date > today,
    invalidDate = !date || (!!before?.effectiveFrom && date < before.effectiveFrom)
  const availability = published
    ? 'published'
    : technical
      ? 'technical'
      : invalidDate
        ? 'date'
        : pending
          ? 'review'
          : future
            ? 'future'
            : 'ready'
  const themes = [...new Set(rows.map((row) => (row.after ?? row.before)!.source.sheet))].map((sheet) => ({
    sheet,
    total: rows.filter((row) => (row.after ?? row.before)!.source.sheet === sheet).length,
    changed: rows.filter(
      (row) => row.kind !== 'unchanged' && (row.after ?? row.before)!.source.sheet === sheet,
    ).length,
    pending: tasks.filter((task) => task.sheet === sheet && task.status === 'pending').length,
  }))
  return {
    fingerprint,
    policyVersion: REVIEW_POLICY.version,
    thresholdPercent: REVIEW_POLICY.percent,
    tasks,
    pending,
    accepted: tasks.length - pending,
    affectedRows: [...groups.values()].reduce((sum, item) => sum + item.rows.length, 0),
    technical,
    availability,
    themes,
  }
}
export function taskRows(task: ReviewTask, rows: Difference[]) {
  const keys = new Set(task.memberKeys)
  return rows.filter((row) => keys.has(row.key))
}
