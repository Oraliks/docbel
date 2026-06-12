import { describe, it, expect } from 'vitest'
import { parseBasicAmounts } from '../parsers/parseBasicAmounts'
import type { ParsedSheet } from '@/lib/baremes-parser'

function makeSheet(cellData: string[][]): ParsedSheet {
  return {
    name: 'Basisbedragen',
    category: 'Montants de base',
    sheetIndex: 11,
    rowCount: cellData.length,
    colCount: Math.max(...cellData.map((r) => r.length), 0),
    cellData,
    searchText: '',
  }
}

const VALID_FROM = new Date('2026-04-01T00:00:00Z')

describe('parseBasicAmounts', () => {
  it('extrait les montants de base à partir de la ligne d’en-tête détectée', () => {
    const sheet = makeSheet([
      ['Basisbedragen', '4/1/26'],
      [''],
      ['Artikel', 'Wat', '', 'Basisbedrag', 'Freq bedrag', 'Zie'],
      [''],
      [''],
      [''],
      ['28, § 2', 'GMMI vanaf 0', 'D7', '2,189.81', 'maand', 'cao 43'],
      ['', 'GMMI op 01/0', 'D8', '2,029.88', 'maand', ''],
      ['36quater', 'Bedrag stage', 'D10', '26.82', 'dag', ''],
    ])

    const result = parseBasicAmounts(sheet, { validFrom: VALID_FROM })

    expect(result.amounts.length).toBe(3)

    const first = result.amounts[0]
    expect(first.article).toBe('28, § 2')
    expect(first.labelNl).toBe('GMMI vanaf 0')
    expect(first.amount).toBeCloseTo(2189.81, 2)
    expect(first.unit).toBe('monthly')
    expect(first.category).toBe('basic_amount')
    expect(first.comparisonKey).toBe('basic_amount:D7')
    expect(first.rawData).toMatchObject({ internalCode: 'D7', reference: 'cao 43' })
    expect(first.validFrom).toEqual(VALID_FROM)

    // L'article est hérité si la cellule article est vide (ligne 2)
    expect(result.amounts[1].article).toBe('28, § 2')
    expect(result.amounts[1].unit).toBe('monthly')

    // dag → daily
    expect(result.amounts[2].unit).toBe('daily')
  })

  it('signale une erreur si la colonne Basisbedrag est introuvable', () => {
    const sheet = makeSheet([
      ['Artikel', 'Wat', 'PasDeMontant'],
      ['art', 'label', '100'],
    ])
    const result = parseBasicAmounts(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(0)
    expect(result.alerts.some((a) => a.level === 'error')).toBe(true)
  })

  it('ignore les lignes sans montant numérique', () => {
    const sheet = makeSheet([
      ['Artikel', 'Wat', '', 'Basisbedrag', 'Freq bedrag'],
      ['art 1', 'desc', '', '100.00', 'dag'],
      ['art 2', 'desc 2', '', '', 'dag'], // pas de montant → ignorée
      ['art 3', 'desc 3', '', 'NaN', 'dag'], // pas un nombre → ignorée
    ])
    const result = parseBasicAmounts(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(1)
    expect(result.amounts[0].article).toBe('art 1')
    expect(result.alerts.some((a) => a.level === 'info' && a.kind === 'ignored_row')).toBe(true)
    // Les lignes écartées sont tracées individuellement avec leur raison
    expect(result.ignoredRows).toHaveLength(2)
    expect(result.ignoredRows?.map((r) => r.rowIndex)).toEqual([3, 4])
    expect(result.ignoredRows?.[0].reason).toBeTruthy()
  })

  it('trace la provenance de chaque montant extrait', () => {
    const sheet = makeSheet([
      ['Artikel', 'Wat', '', 'Basisbedrag', 'Freq bedrag'],
      ['art 1', 'desc', 'D7', '100.00', 'dag'],
    ])
    const result = parseBasicAmounts(sheet, { validFrom: VALID_FROM })
    expect(result.amounts).toHaveLength(1)
    const trace = result.amounts[0].trace
    expect(trace?.sourceCell).toBe('D2')
    expect(trace?.sourceRowIndex).toBe(2)
    expect(trace?.rawValue).toBe('100.00')
    expect(trace?.normalizedValue).toBe(100)
    expect(trace?.transformTemplate).toBe('basic_amounts')
    expect(trace?.transformReason).toContain('D2')
    expect(result.amounts[0].status).toBe('valid')
  })
})
