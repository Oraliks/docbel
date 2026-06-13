import { describe, it, expect } from 'vitest'
import { verifyRoundTrip } from '../verifyRoundTrip'
import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAmountDraft } from '../types'

function sheet(cellData: string[][]): ParsedSheet {
  return {
    name: 'TestSheet',
    category: 'Test',
    sheetIndex: 0,
    rowCount: cellData.length,
    colCount: Math.max(...cellData.map((r) => r.length), 0),
    cellData,
    searchText: '',
  }
}

function amount(over: Partial<BaremeAmountDraft> & { trace: BaremeAmountDraft['trace'] }): BaremeAmountDraft {
  return {
    sourceSheet: 'TestSheet',
    category: 'full_unemployment',
    amount: 0,
    unit: 'daily',
    validFrom: null,
    comparisonKey: 'k',
    status: 'valid',
    warnings: [],
    ...over,
  } as BaremeAmountDraft
}

describe('verifyRoundTrip', () => {
  it('valide un montant DIRECT (cellule = valeur normalisée)', () => {
    const s = sheet([
      ['', ''],
      ['', '76.55'], // B2
    ])
    const a = amount({
      amount: 76.55,
      comparisonKey: 'full_unemployment:AA1:MIN',
      trace: { sourceCell: 'B2', sourceRowIndex: 2, sourceColumnIndex: 2, rawValue: '76.55', normalizedValue: 76.55 },
    })
    const res = verifyRoundTrip([s], [a])
    expect(res.mismatches).toBe(0)
    expect(res.direct).toBe(1)
    expect(res.checked).toBe(1)
  })

  it('valide un montant DÉRIVÉ (cellule = code, montant = borne convertie)', () => {
    const s = sheet([['', '', '', '', '29']]) // E1 = code 29
    const a = amount({
      amount: 63.6114,
      category: 'salary_bracket',
      comparisonKey: 'salary_bracket:29',
      trace: { sourceCell: 'E1', sourceRowIndex: 1, sourceColumnIndex: 5, rawValue: '29', normalizedValue: 63.6114 },
    })
    const res = verifyRoundTrip([s], [a])
    expect(res.mismatches).toBe(0)
    expect(res.derived).toBe(1)
  })

  it('DÉTECTE un décalage de cellule (valeur incohérente)', () => {
    const s = sheet([
      ['', ''],
      ['', '50.00'], // B2 contient 50, mais le montant prétend 76.55
    ])
    const a = amount({
      amount: 76.55,
      comparisonKey: 'full_unemployment:AA1:MIN',
      trace: { sourceCell: 'B2', sourceRowIndex: 2, sourceColumnIndex: 2, rawValue: '76.55', normalizedValue: 76.55 },
    })
    const res = verifyRoundTrip([s], [a])
    expect(res.mismatches).toBe(1)
    expect(res.alerts[0].level).toBe('error')
  })

  it('DÉTECTE une cellule source vide', () => {
    const s = sheet([['', '']])
    const a = amount({
      amount: 76.55,
      trace: { sourceCell: 'B1', sourceRowIndex: 1, sourceColumnIndex: 2, rawValue: '76.55', normalizedValue: 76.55 },
    })
    const res = verifyRoundTrip([s], [a])
    expect(res.mismatches).toBe(1)
  })
})
