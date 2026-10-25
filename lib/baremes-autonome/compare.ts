import { createHash } from 'node:crypto'
import type { Difference, RateValue, Reading, Snapshot } from './types'

export function digest(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical)
    if (item !== null && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]))
    return item
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

export function compareReadings(before: Reading | null, after: Reading): Difference[] {
  const context = (value: RateValue, reading: Reading) => {
    const date = value.effectiveFrom ?? value.context.find(part => /^date:\d{4}-\d{2}-\d{2}$/.test(part))?.slice(5) ?? reading.effectiveFrom
    const unit = value.unit === 'EUR' && value.context.includes('frequence:jaar') ? 'EUR/year' : value.unit === 'EUR' && value.context.includes('frequence:uur') ? 'EUR/hour' : value.unit
    return [value.label, unit, value.context, value.indexation?.value ?? null, date, value.valueKind ?? null]
  }
  const old = new Map(before?.values.map((value) => [value.key, value]))
  const current = new Map(after.values.map((value) => [value.key, value]))
  if (old.size !== (before?.values.length ?? 0) || current.size !== after.values.length) {
    throw new Error('AMBIGUOUS_IDENTITY')
  }
  return [...new Set([...old.keys(), ...current.keys()])].sort().map((key) => {
    const a = old.get(key) ?? null
    const b = current.get(key) ?? null
    const contextChanged = !!a && !!b && digest(context(a, before!)) !== digest(context(b, after))
    return { key, before: a, after: b, contextChanged,
      kind: !a ? 'added' : !b ? 'absent' : a.value !== b.value || contextChanged ? 'modified' : 'unchanged' }
  })
}

export function snapshotDigest(snapshot: Omit<Snapshot, 'digest'>): string {
  return digest(snapshot)
}
