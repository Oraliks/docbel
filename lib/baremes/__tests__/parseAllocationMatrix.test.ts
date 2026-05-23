import { describe, it, expect } from 'vitest'
import { parseAllocationMatrix } from '../parsers/parseAllocationMatrix'
import type { ParsedSheet } from '@/lib/baremes-parser'

function makeSheet(cellData: string[][], name = 'A_N_B_vol_plein'): ParsedSheet {
  return {
    name,
    category: 'Allocations chômage - Plein temps',
    sheetIndex: 0,
    rowCount: cellData.length,
    colCount: Math.max(...cellData.map((r) => r.length), 0),
    cellData,
    searchText: '',
  }
}

const VALID_FROM = new Date('2026-04-01T00:00:00Z')

describe('parseAllocationMatrix', () => {
  it('extrait les montants à l’intersection (code × tranche)', () => {
    // Grille minimale mimant la structure A_N_B_vol_plein
    const sheet = makeSheet([
      ['Geldig/valable'], // R0
      ['1/03/2026'], // R1
      [''], // R2
      [''], // R3
      [''], // R4
      [''], // R5
      [''], // R6
      [''], // R7
      ['Code', '', 'AA1', 'AA2', 'AA3', '', 'AFoud', 'AB\nAX'], // R8 — header avec codes
      [''],
      [''],
      ['MIN', '', '76.55', '76.55', '69.59', '', '', '69.59'], // R11 — MIN tranche
      ['1', '', '76.55', '76.55', '69.59', '', '#REF!', '69.59'], // R12 — ancienneté 1
      ['2', '', '76.55', '76.55', '69.59', '', '#REF!', '69.59'], // R13
    ])

    const result = parseAllocationMatrix(sheet, {
      category: 'full_unemployment',
      validFrom: VALID_FROM,
    })

    // 5 codes uniques (AA1, AA2, AA3, AFoud, AB, AX) × 3 tranches (MIN, 1, 2)
    // MIN row : 4 montants (AA1, AA2, AA3, AB/AX dupliqué pour AB et AX) → 5 (AFoud vide)
    // En réalité : MIN ligne a 5 montants pleins (AA1=76.55, AA2=76.55, AA3=69.59, AB=69.59, AX=69.59)
    // Lignes 1 et 2 : 5 montants chacune (AFoud=#REF! ignoré)
    expect(result.amounts.length).toBeGreaterThanOrEqual(12)

    // Vérifier exemple précis de la spec : AA1 / MIN = 76.55
    const aa1Min = result.amounts.find(
      (a) => a.allocationCode === 'AA1' && a.salaryCode === 'MIN'
    )
    expect(aa1Min).toBeDefined()
    expect(aa1Min!.amount).toBe(76.55)
    expect(aa1Min!.category).toBe('full_unemployment')
    expect(aa1Min!.comparisonKey).toBe('full_unemployment:AA1:MIN')
    expect(aa1Min!.validFrom).toEqual(VALID_FROM)
  })

  it('split les codes multi-lignes (AB\\nAX) en deux montants', () => {
    const sheet = makeSheet([
      ['Geldig'],
      ['1/03/2026'],
      [''],
      [''],
      [''],
      [''],
      [''],
      [''],
      ['Code', '', 'AB\nAX'],
      [''],
      [''],
      ['MIN', '', '69.59'],
    ])

    const result = parseAllocationMatrix(sheet, {
      category: 'full_unemployment',
      validFrom: VALID_FROM,
    })

    const ab = result.amounts.find((a) => a.allocationCode === 'AB' && a.salaryCode === 'MIN')
    const ax = result.amounts.find((a) => a.allocationCode === 'AX' && a.salaryCode === 'MIN')
    expect(ab).toBeDefined()
    expect(ax).toBeDefined()
    expect(ab!.amount).toBe(69.59)
    expect(ax!.amount).toBe(69.59)
  })

  it('ignore les cellules d’erreur (#REF!) et les signale', () => {
    const sheet = makeSheet([
      ['Code', '', 'AA1'],
      ['MIN', '', '#REF!'],
      ['1', '', '#REF!'],
      ['2', '', '76.55'],
    ])

    const result = parseAllocationMatrix(sheet, {
      category: 'full_unemployment',
      validFrom: VALID_FROM,
    })

    expect(result.amounts).toHaveLength(1)
    expect(result.amounts[0].salaryCode).toBe('2')
    expect(result.amounts[0].amount).toBe(76.55)
    expect(result.alerts.some((a) => a.level === 'info' && a.message.includes('#REF!'))).toBe(true)
  })

  it('retourne une alerte error si la ligne Code est introuvable', () => {
    const sheet = makeSheet([
      ['Pas de header', '', 'AA1'],
      ['MIN', '', '76.55'],
    ])
    const result = parseAllocationMatrix(sheet, {
      category: 'full_unemployment',
      validFrom: VALID_FROM,
    })
    expect(result.amounts).toHaveLength(0)
    expect(result.alerts.some((a) => a.level === 'error')).toBe(true)
  })

  it('s’arrête à la première ligne non vide hors tranche (notes en bas de feuille)', () => {
    const sheet = makeSheet([
      ['Code', '', 'AA1'],
      ['MIN', '', '76.55'],
      ['1', '', '77.00'],
      ['Note: voir CCT', '', ''],
      ['2', '', '78.00'], // ne devrait pas être extrait après la note
    ])
    const result = parseAllocationMatrix(sheet, {
      category: 'full_unemployment',
      validFrom: VALID_FROM,
    })
    expect(result.amounts.find((a) => a.salaryCode === '2')).toBeUndefined()
    expect(result.amounts.find((a) => a.salaryCode === '1')).toBeDefined()
  })
})
