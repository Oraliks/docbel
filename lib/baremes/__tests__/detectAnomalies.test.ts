import { describe, expect, it } from 'vitest'
import { ANOMALY_THRESHOLDS, detectAnomaliesFromDiff } from '../compareBaremeVersions'
import type { BaremeDiff } from '../types'

function makeDiff(changes: BaremeDiff['changes']): BaremeDiff {
  const countsByType = { modified: 0, unchanged: 0, added: 0, disappeared: 0, ambiguous: 0 }
  for (const change of changes) countsByType[change.type]++
  const reference = { id: 'previous', name: 'previous', status: 'published', fileType: 'onem-rates', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'old' }
  const candidate = { id: 'candidate', name: 'candidate', status: 'draft', fileType: 'onem-rates', validFrom: '2026-02-01T00:00:00.000Z', dataRevision: 'new' }
  return { changes, previousFileId: reference.id, newFileId: candidate.id, state: 'computed', candidate, reference, candidateDataRevision: 'new', referenceDataRevision: 'old', countsByType, countsByChange: { amount: 0, attributes: 0 } }
}

const modified = (oldValue: number, newValue: number) => ({ type: 'modified' as const, key: 'x', oldValue, newValue, category: 'full_unemployment', amountChanged: true })

describe('detectAnomaliesFromDiff', () => {
  it('signale les variations importantes, sans arrondir les valeurs source', () => {
    expect(detectAnomaliesFromDiff(makeDiff([modified(100, 125)])).at(0)?.level).toBe('warn')
    const alerts = detectAnomaliesFromDiff(makeDiff([modified(100.1234, 200.1234)]))
    expect(alerts.at(0)?.message).toContain('100.1234')
  })
  it('ignore les ajouts, disparitions et une variation depuis zéro', () => {
    expect(detectAnomaliesFromDiff(makeDiff([
      { type: 'added', key: 'a', newValue: 100, category: 'basic_amount' },
      { type: 'disappeared', key: 'b', oldValue: 100, category: 'basic_amount' },
      modified(0, 50),
    ]))).toHaveLength(0)
  })
  it('expose les seuils utilisés par les diagnostics', () => {
    expect(ANOMALY_THRESHOLDS.error).toBeGreaterThan(ANOMALY_THRESHOLDS.warn)
  })
})
