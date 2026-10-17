import { describe, expect, it } from 'vitest'
import { buildBaremeDiff } from '../compareBaremeVersions'
import type { BaremeComparableAmount, BaremeComparisonFileRef } from '../types'

const reference: BaremeComparisonFileRef = { id: 'old', name: 'old.xlsx', status: 'published', fileType: 'onem-rates', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'old-revision' }
const candidate: BaremeComparisonFileRef = { id: 'new', name: 'new.xlsx', status: 'draft', fileType: 'onem-rates', validFrom: '2026-04-01T00:00:00.000Z', dataRevision: 'new-revision' }
function amount(id: string, key: string, value: number, overrides: Partial<BaremeComparableAmount> = {}): BaremeComparableAmount {
  return { id, comparisonKey: key, amount: value, sourceSheet: 'Feuille 1', category: 'full_unemployment', allocationCode: key, salaryCode: null, article: null, labelFr: key, labelNl: null, unit: 'daily', minDailySalary: null, maxDailySalary: null, trace: { sourceCell: `${id}1`, sourceRowIndex: 1, sourceColumnIndex: 1, rawValue: String(value), normalizedValue: value }, ...overrides }
}

describe('buildBaremeDiff', () => {
  it('couvre les quatre états, les attributs et la précision à quatre décimales', () => {
    const diff = buildBaremeDiff(
      [amount('n1', 'modified', 10.1235), amount('n2', 'unchanged', 20), amount('n3', 'added', 30), amount('n4', 'unit', 40, { unit: 'monthly' })],
      [amount('o1', 'modified', 10.1234), amount('o2', 'unchanged', 20), amount('o4', 'unit', 40, { unit: 'daily' }), amount('o5', 'disappeared', 50)],
      candidate, reference
    )
    expect(diff.countsByType).toMatchObject({ modified: 2, unchanged: 1, added: 1, disappeared: 1, ambiguous: 0 })
    expect(diff.changes.find((row) => row.key === 'modified')).toMatchObject({ type: 'modified', amountChanged: true, oldValue: 10.1234, newValue: 10.1235 })
    expect(diff.changes.find((row) => row.key === 'unit')?.changedAttributes).toEqual(['unit'])
  })
  it('isole les collisions au lieu de les rapprocher arbitrairement', () => {
    const diff = buildBaremeDiff([amount('n1', 'duplicate', 10), amount('n2', 'duplicate', 11)], [amount('o1', 'duplicate', 10)], candidate, reference)
    expect(diff.countsByType.ambiguous).toBe(3)
    expect(diff.changes.every((row) => row.warning === 'ambiguous_identity')).toBe(true)
  })
  it('réconcilie les totaux lorsqu’aucune identité n’est ambiguë', () => {
    const diff = buildBaremeDiff([amount('n1', 'same', 1), amount('n2', 'added', 2)], [amount('o1', 'same', 1), amount('o2', 'gone', 3)], candidate, reference)
    expect(2).toBe(diff.countsByType.unchanged + diff.countsByType.modified + diff.countsByType.disappeared)
    expect(2).toBe(diff.countsByType.unchanged + diff.countsByType.modified + diff.countsByType.added)
  })
  it('conserve plus de 100 changements pour la pagination et l’export serveur', () => {
    const oldRows = Array.from({ length: 135 }, (_, index) => amount(`o${index}`, `key-${index}`, index))
    const newRows = Array.from({ length: 135 }, (_, index) => amount(`n${index}`, `key-${index}`, index + 0.0001))
    const diff = buildBaremeDiff(newRows, oldRows, candidate, reference)
    expect(diff.changes).toHaveLength(135)
    expect(diff.countsByType.modified).toBe(135)
    expect(diff.changes.slice(100, 135)).toHaveLength(35)
  })
})
