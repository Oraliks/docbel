import { describe, it, expect } from 'vitest'
import { parseSalaryBrackets } from '../parsers/parseSalaryBrackets'
import type { ParsedSheet } from '@/lib/baremes-parser'

function makeSheet(cellData: string[][]): ParsedSheet {
  return {
    name: 'Loonschijven_Tranches salariale',
    category: 'Tranches salariales',
    sheetIndex: 4,
    rowCount: cellData.length,
    colCount: Math.max(...cellData.map((r) => r.length), 0),
    cellData,
    searchText: '',
  }
}

const VALID_FROM = new Date('2026-04-01T00:00:00Z')

describe('parseSalaryBrackets', () => {
  it('extrait les tranches de la table gauche (layout min, max, _, code)', () => {
    const sheet = makeSheet([
      // R0..R6 vides
      [''],
      [''],
      [''],
      [''],
      [''],
      [''],
      [''],
      // R7
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // R8 — layout gauche: B=min, C=max, E=code (col 1, 2, 4)
      ['', '62.0788', '63.6114', '', '29'],
      ['', '63.6115', '65.1441', '', '30'],
      ['', '65.1442', '66.6768', '', '31'],
    ])

    const result = parseSalaryBrackets(sheet, { validFrom: VALID_FROM })

    expect(result.amounts.length).toBe(3)

    const tranche29 = result.amounts.find((a) => a.salaryCode === '29')
    expect(tranche29).toBeDefined()
    expect(tranche29!.minDailySalary).toBeCloseTo(62.0788, 4)
    expect(tranche29!.maxDailySalary).toBeCloseTo(63.6114, 4)
    expect(tranche29!.category).toBe('salary_bracket')
    expect(tranche29!.comparisonKey).toBe('salary_bracket:29')
    expect(tranche29!.validFrom).toEqual(VALID_FROM)
  })

  it('extrait les tranches de la table droite (layout code, min, max)', () => {
    const sheet = makeSheet([
      // Table droite uniquement, code en col 12 puis min/max en c+1, c+2
      // (cols 0-11 vides)
      ['', '', '', '', '', '', '', '', '', '', '', '', '1', '10.7914', '11.6544', '11.2230'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '2', '11.6545', '12.5175', '12.0861'],
    ])

    const result = parseSalaryBrackets(sheet, { validFrom: VALID_FROM })
    expect(result.amounts.length).toBe(2)

    const t1 = result.amounts.find((a) => a.salaryCode === '1')
    expect(t1!.minDailySalary).toBeCloseTo(10.7914, 4)
    expect(t1!.maxDailySalary).toBeCloseTo(11.6544, 4)
    expect(t1!.rawData).toMatchObject({ midDailySalary: 11.223 })
  })

  it('mixe les deux tables sans doublons', () => {
    const sheet = makeSheet([
      // Une ligne avec table droite (codes 1..) ET table gauche (codes 29+)
      ['', '62.0788', '63.6114', '', '29', '', '', '', '', '', '', '', '1', '10.7914', '11.6544', '11.2230'],
    ])

    const result = parseSalaryBrackets(sheet, { validFrom: VALID_FROM })
    expect(result.amounts.length).toBe(2)
    expect(result.amounts.map((a) => a.salaryCode).sort()).toEqual(['1', '29'])
  })

  it('signale une erreur si aucune tranche détectée', () => {
    const sheet = makeSheet([['', 'pas', 'de', 'données', 'numériques']])
    const result = parseSalaryBrackets(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(0)
    expect(result.alerts.some((a) => a.level === 'error')).toBe(true)
  })

  it('rejette les valeurs où max < min', () => {
    const sheet = makeSheet([
      ['', '100', '50', '', '99'], // max < min → invalide
    ])
    const result = parseSalaryBrackets(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(0)
  })
})
