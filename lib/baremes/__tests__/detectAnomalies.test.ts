import { describe, it, expect } from 'vitest'
import {
  detectAnomaliesFromDiff,
  ANOMALY_THRESHOLDS,
} from '../compareBaremeVersions'
import type { BaremeDiff } from '../types'

function makeDiff(changes: BaremeDiff['changes']): BaremeDiff {
  const countsByType = { amount_changed: 0, new_entry: 0, removed_entry: 0 }
  for (const c of changes) countsByType[c.type]++
  return { changes, previousFileId: 'prev', newFileId: 'new', countsByType }
}

describe('detectAnomaliesFromDiff', () => {
  it('aucune alerte si toutes les variations sont sous le seuil (8%)', () => {
    const diff = makeDiff([
      {
        type: 'amount_changed',
        key: 'x',
        oldValue: 100,
        newValue: 105, // +5%
        category: 'full_unemployment',
      },
      {
        type: 'amount_changed',
        key: 'y',
        oldValue: 200,
        newValue: 213, // +6.5%
        category: 'full_unemployment',
      },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts).toHaveLength(0)
  })

  it('alerte warn pour les variations entre 8% et 50%', () => {
    const diff = makeDiff([
      {
        type: 'amount_changed',
        key: 'x',
        oldValue: 100,
        newValue: 125, // +25%
        category: 'full_unemployment',
      },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('warn')
    expect(alerts[0].message).toContain('8%')
  })

  it('alerte error pour les variations >50%', () => {
    const diff = makeDiff([
      {
        type: 'amount_changed',
        key: 'x',
        oldValue: 100,
        newValue: 200, // +100%
        category: 'full_unemployment',
      },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('error')
    expect(alerts[0].message).toContain('50%')
  })

  it('détecte les baisses comme les hausses', () => {
    const diff = makeDiff([
      {
        type: 'amount_changed',
        key: 'x',
        oldValue: 200,
        newValue: 100, // -50% (== seuil error)
        category: 'full_unemployment',
      },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts.some((a) => a.level === 'error')).toBe(true)
  })

  it('ignore les new_entry et removed_entry (pas comparables)', () => {
    const diff = makeDiff([
      { type: 'new_entry', key: 'x', newValue: 100, category: 'basic_amount' },
      { type: 'removed_entry', key: 'y', oldValue: 100, category: 'basic_amount' },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts).toHaveLength(0)
  })

  it('évite la division par zéro pour oldValue=0', () => {
    const diff = makeDiff([
      {
        type: 'amount_changed',
        key: 'x',
        oldValue: 0,
        newValue: 50,
        category: 'full_unemployment',
      },
    ])
    const alerts = detectAnomaliesFromDiff(diff)
    expect(alerts).toHaveLength(0)
  })

  it('expose les seuils via ANOMALY_THRESHOLDS', () => {
    expect(ANOMALY_THRESHOLDS.warn).toBeGreaterThan(0)
    expect(ANOMALY_THRESHOLDS.error).toBeGreaterThan(ANOMALY_THRESHOLDS.warn)
  })
})
