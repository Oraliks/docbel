import { describe, expect, it } from 'vitest'
import { normalizeBaremeData } from '../normalizeBaremeData'
import type { ParsedBaremaData } from '@/lib/baremes-parser'

describe('normalizeBaremeData collisions', () => {
  it('preserves colliding rows so comparison cannot select the first one silently', () => {
    const parsed: ParsedBaremaData = {
      fileMetadata: { effectiveDate: '' },
      sheets: [{
        name: 'Basisbedragen', category: 'Montants de base', sheetIndex: 0,
        rowCount: 4, colCount: 6, searchText: '',
        cellData: [
          ['Artikel', 'Wat', '', 'Basisbedrag', 'Freq bedrag', 'Zie'],
          ['28 § 2', 'Libellé un', 'D7', '100', 'dag', ''],
          ['36quater', 'Libellé deux', 'D7', '120', 'dag', ''],
        ],
      }],
    }

    const normalized = normalizeBaremeData(parsed, new Date('2026-04-01T00:00:00.000Z'))

    expect(normalized.amounts).toHaveLength(2)
    expect(normalized.amounts.map((row) => row.comparisonKey)).toEqual(['basic_amount:D7', 'basic_amount:D7'])
    expect(normalized.amounts.every((row) => row.status === 'warning')).toBe(true)
    expect(normalized.diagnostics.duplicates).toHaveLength(1)
    expect(normalized.diagnostics.duplicates[0].count).toBe(2)
    expect(normalized.diagnostics.collisions).toEqual([
      { comparisonKey: 'basic_amount:D7', count: 2, cells: ['Basisbedragen!D2', 'Basisbedragen!D3'] },
    ])
  })
})
