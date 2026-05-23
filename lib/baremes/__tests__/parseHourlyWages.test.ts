import { describe, it, expect } from 'vitest'
import { parseHourlyWages } from '../parsers/parseHourlyWages'
import type { ParsedSheet } from '@/lib/baremes-parser'

function makeSheet(cellData: string[][]): ParsedSheet {
  return {
    name: 'Uurlonen_Salaires horaires',
    category: 'Salaires horaires',
    sheetIndex: 5,
    rowCount: cellData.length,
    colCount: Math.max(...cellData.map((r) => r.length), 0),
    cellData,
    searchText: '',
  }
}

const VALID_FROM = new Date('2026-04-01T00:00:00Z')

describe('parseHourlyWages', () => {
  it('extrait les salaires horaires (code × heures)', () => {
    const sheet = makeSheet([
      [''],
      [''],
      [''],
      [''],
      [''],
      [''],
      // R6 : ligne d'en-tête "Q" en A, "Code" en C, heures à partir de D
      ['Q', '', 'Code', '40', '39.5', '39'],
      // R7+ : code en C, salaires en D, E, F
      ['', '', '29', '9.3119', '9.4297', '9.5506'],
      ['', '', '30', '9.5418', '9.6626', '9.7864'],
    ])

    const result = parseHourlyWages(sheet, { validFrom: VALID_FROM })

    // 2 codes × 3 colonnes d'heures = 6 montants
    expect(result.amounts).toHaveLength(6)

    const t29at40 = result.amounts.find(
      (a) => a.salaryCode === '29' && a.comparisonKey === 'hourly_wage:29:40'
    )
    expect(t29at40).toBeDefined()
    expect(t29at40!.amount).toBeCloseTo(9.3119, 4)
    expect(t29at40!.category).toBe('hourly_wage')
    expect(t29at40!.unit).toBe('hourly')
    expect(t29at40!.rawData).toMatchObject({ hoursPerWeek: 40 })
  })

  it('signale une erreur si la ligne "Code" est introuvable', () => {
    const sheet = makeSheet([['', '', 'pas de header'], ['', '', '29', '9.31']])
    const result = parseHourlyWages(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(0)
    expect(result.alerts.some((a) => a.level === 'error')).toBe(true)
  })

  it('ignore les heures hors plage (>50 ou ≤0)', () => {
    const sheet = makeSheet([
      ['Q', '', 'Code', '40', '99', '0'],
      ['', '', '29', '9.31', '999', '0.5'],
    ])
    const result = parseHourlyWages(sheet, { validFrom: VALID_FROM })
    // Seule la colonne 40h doit être prise
    expect(result.amounts).toHaveLength(1)
    expect(result.amounts[0].salaryCode).toBe('29')
  })
})
