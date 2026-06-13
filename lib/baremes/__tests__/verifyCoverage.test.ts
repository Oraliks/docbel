import { describe, it, expect } from 'vitest'
import { verifyCoverage } from '../verifyCoverage'
import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAmountDraft } from '../types'

// Feuille dense factice nommée comme un contrat de couverture (dataRowFrom=12).
function denseSheet(rows: Record<string, string | number>[]): ParsedSheet {
  // rows[i] : map "colLetter" → value, posée à la ligne 12+i
  const cellData: string[][] = []
  for (let i = 0; i < 12 + rows.length; i++) cellData.push([])
  rows.forEach((r, i) => {
    const rowArr: string[] = []
    for (const [col, v] of Object.entries(r)) {
      const c = col.charCodeAt(0) - 65
      rowArr[c] = String(v)
    }
    cellData[11 + i] = rowArr
  })
  return { name: 'A_N_B_vol_plein', category: 'x', sheetIndex: 0, rowCount: cellData.length, colCount: 10, cellData, searchText: '' }
}

function tracedAmount(cell: string, value: number): BaremeAmountDraft {
  const m = /^([A-Z])(\d+)$/.exec(cell)!
  return {
    sourceSheet: 'A_N_B_vol_plein',
    category: 'full_unemployment',
    amount: value,
    unit: 'daily',
    validFrom: null,
    comparisonKey: `k:${cell}`,
    status: 'valid',
    warnings: [],
    trace: { sourceCell: cell, sourceRowIndex: Number(m[2]), sourceColumnIndex: m[1].charCodeAt(0) - 64, rawValue: String(value), normalizedValue: value },
  } as BaremeAmountDraft
}

describe('verifyCoverage', () => {
  it('0 orphelin quand toutes les cellules montant sont tracées', () => {
    const sheet = denseSheet([{ C: 76.55, D: 69.59 }]) // ligne 12
    const amounts = [tracedAmount('C12', 76.55), tracedAmount('D12', 69.59)]
    const res = verifyCoverage([sheet], amounts)
    expect(res.results[0].orphans).toHaveLength(0)
    expect(res.alerts).toHaveLength(0)
  })

  it('détecte un montant oublié (cellule non tracée, valeur unique dans la ligne)', () => {
    const sheet = denseSheet([{ C: 76.55, D: 69.59, E: 50.11 }]) // E12 non tracé
    const amounts = [tracedAmount('C12', 76.55), tracedAmount('D12', 69.59)]
    const res = verifyCoverage([sheet], amounts)
    expect(res.results[0].orphans).toContain('E12=50.11')
    expect(res.alerts.some((a) => a.level === 'warn' && /couverture inverse/i.test(a.title ?? ''))).toBe(true)
  })

  it('ignore un doublon de cellule fusionnée (même valeur tracée dans la ligne)', () => {
    const sheet = denseSheet([{ B: 68.76, C: 68.76 }]) // C = copie non tracée de B
    const amounts = [tracedAmount('B12', 68.76)]
    const res = verifyCoverage([sheet], amounts)
    expect(res.results[0].orphans).toHaveLength(0)
  })

  it('ignore taux (<1), entiers et cellules au-dessus de la zone de données', () => {
    const sheet = denseSheet([{ C: 0.65, D: 42, E: 76.55 }])
    // place aussi une décimale en ligne 10 (au-dessus de dataRowFrom=12)
    sheet.cellData[9] = []
    sheet.cellData[9][5] = '1.7758'
    const amounts = [tracedAmount('E12', 76.55)]
    const res = verifyCoverage([sheet], amounts)
    expect(res.results[0].orphans).toHaveLength(0) // 0.65<1, 42 entier, 1.7758 hors zone
  })
})
