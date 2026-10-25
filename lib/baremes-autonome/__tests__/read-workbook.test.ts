import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CURRENT_PARSER_VERSION, isSupportedReaderVersion, readWorkbook, readWorkbookFromParsedWorkbook, readWorkbookVersion, UnsupportedReaderVersion } from '../read-workbook'
import { digest } from '../compare'

function workbookBuffer(sheets: Record<string, unknown[][]>, formula?: { sheet: string; address: string; expression: string; cached?: number }): Buffer {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    if (formula?.sheet === name) {
      worksheet[formula.address] = { t: 'n', f: formula.expression, v: formula.cached ?? null }
    }
    XLSX.utils.book_append_sheet(wb, worksheet, name)
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function dailySheet(amount: number | string = 12.34): unknown[][] {
  const rows: unknown[][] = Array.from({ length: 111 }, () => [])
  rows[0][0] = 'Geldig/valable'
  rows[0][20] = 'Multiplicateur'; rows[0][22] = 1.8114
  rows[1][0] = new Date(Date.UTC(2026, 8, 1))
  rows[3][2] = 'Werknemers met gezinslast / Travailleurs ayant charge de famille'
  rows[3][8] = 'Alleenwonenden / Isolés'; rows[3][14] = 'Samenwonenden / Cohabitants'
  rows[5][2] = '1e periode'; rows[6][2] = '1ère période'; rows[5][6] = '2e periode'; rows[6][6] = '2ème période'
  rows[5][8] = '1e periode'; rows[6][8] = '1ère période'; rows[5][12] = '2e periode'; rows[6][12] = '2ème période'
  rows[5][14] = '1e periode'; rows[6][14] = '1ère période'; rows[5][18] = '2e periode'; rows[6][18] = 'BV+ / PP+'
  rows[6][19] = 'BV- / PP-'
  rows[8][0] = 'Code'
  const columns: Array<[number, string]> = [[2, 'AA1'], [3, 'AA2'], [4, 'AA3'], [6, 'AB\nAX'], [8, 'NA1'], [9, 'NA2'], [10, 'NA3'], [12, 'NB\nNX'], [14, 'BA1'], [15, 'BA2'], [16, 'BA3'], [18, 'BX'], [19, 'BB']]
  for (const [col, code] of columns) rows[8][col] = code
  for (const [col] of columns) rows[10][col] = 0.65
  rows[11][0] = 'MIN'
  for (const [col] of columns) rows[11][col] = amount
  for (let r = 12; r < 111; r++) { rows[r][0] = r - 11; for (const [col] of columns) rows[r][col] = amount }
  return rows
}
function movedGrid(rows: unknown[][], rowOffset: number, columnOffset: number): unknown[][] {
  const moved: unknown[][] = Array.from({ length: rows.length + rowOffset }, () => [])
  rows.forEach((row, r) => row.forEach((value, c) => { if (value !== undefined) moved[r + rowOffset][c + columnOffset] = value }))
  return moved
}
function basisSheet(amount: number | string = 43.11, unit = 'dag'): unknown[][] {
  const rows: unknown[][] = Array.from({ length: 12 }, () => [])
  rows[0][0] = 'Basisbedragen geldig op'
  rows[0][6] = 'Rang index'; rows[0][7] = 'Multiplicator'
  rows[0][1] = new Date(Date.UTC(2026, 8, 1))
  rows[1][6] = 30; rows[1][7] = 'Gewone regeling'; rows[1][8] = 1.8114; rows[1][9] = new Date(Date.UTC(2026, 8, 1))
  rows[10][0] = 'Artikel KB WLH'; rows[10][1] = 'Wat'; rows[10][3] = 'Basisbedrag'; rows[10][4] = 'Freq bedrag'; rows[10][5] = 'Zie bron'
  rows[11][0] = '115, § 1'; rows[11][1] = 'Minimum VW gezinshoofd'; rows[11][3] = amount; rows[11][4] = unit; rows[11][5] = 'KB 1'
  return rows
}

function referenceWorkbook(): XLSX.WorkBook {
  const path = process.env.DOCBEL_REFERENCE_XLSX ?? fileURLToPath(new URL('./fixtures/barema20260901-new.xlsx', import.meta.url))
  return XLSX.read(readFileSync(path), { type: 'buffer', cellFormula: true, cellDates: false })
}

describe('readWorkbook', () => {
  it('dispatches through an immutable reader registry and preserves the v1 result', () => {
    const path = process.env.DOCBEL_REFERENCE_XLSX ?? fileURLToPath(new URL('./fixtures/barema20260901-new.xlsx', import.meta.url))
    const bytes = readFileSync(path)
    const current = readWorkbook(bytes)
    const currentByVersion = readWorkbookVersion(bytes, 2)
    const v1 = readWorkbookVersion(bytes, 1)

    expect(CURRENT_PARSER_VERSION).toBe(2)
    expect(isSupportedReaderVersion(1)).toBe(true)
    expect(isSupportedReaderVersion(2)).toBe(true)
    expect(isSupportedReaderVersion(99)).toBe(false)
    expect(() => readWorkbookVersion(bytes, 99)).toThrow(UnsupportedReaderVersion)
    expect(digest(current)).toBe(digest(currentByVersion))
    expect(v1).toMatchObject({ parserVersion: 1, effectiveFrom: '2026-09-01' })
    expect(v1.values).toHaveLength(2685)
    expect(v1.issues.filter(issue => issue.blocking)).toHaveLength(0)
    expect(v1.values[0].context).toEqual([
      'Allocation entière', 'Werknemers met gezinslast Travailleurs ayant charge de famille',
      '1e periode', 'Montant indexé: 65%', 'Tranche: MIN',
    ])
    expect(v1.values.find(value => value.source.cell === 'C12')?.source.formula).toBe('ROUND(Basisbedragen!$D$34*$W$1,2)')
  })

  it('reads the supplied reference workbook', () => {
    const path = process.env.DOCBEL_REFERENCE_XLSX ?? fileURLToPath(new URL('./fixtures/barema20260901-new.xlsx', import.meta.url))
    const reading = readWorkbook(readFileSync(path))
    expect(reading.effectiveFrom).toBe('2026-09-01')
    expect(reading.values).toHaveLength(2685)
    expect(reading.values.filter(v => v.table === 'allocation_journaliere_entiere')).toHaveLength(1300)
    expect(reading.values.filter(v => v.table === 'allocation_journaliere_demi')).toHaveLength(1300)
    expect(reading.values.filter(v => v.table === 'basisbedragen_index')).toHaveLength(10)
    expect(reading.values.filter(v => v.table === 'basisbedragen')).toHaveLength(75)
    expect(reading.values.some(v => v.table === 'basisbedragen' && v.value === '92.3956')).toBe(true)
    expect(reading.values.some(v => v.table === 'basisbedragen' && v.unit === 'ratio')).toBe(true)
    expect(reading.values.some(v => v.table === 'allocation_journaliere_entiere')).toBe(true)
    expect(reading.values.some(v => v.table === 'allocation_journaliere_demi')).toBe(true)
    expect(reading.parserVersion).toBe(2)
    expect(reading.coverage).toMatchObject({ contractVersion: 1, auxiliaryCells: 500, tables: [
      { sheet: 'A_N_B_vol_plein', mappedCells: 1300, auxiliaryCells: 0 },
      { sheet: 'A_N_B_half_demi', mappedCells: 1300, auxiliaryCells: 500 },
      { sheet: 'Basisbedragen', mappedCells: 85, auxiliaryCells: 0 },
    ] })
    expect(reading.sheets).toEqual(['A_N_B_vol_plein', 'A_N_B_half_demi', 'Basisbedragen'])
    expect(reading.issues.filter(i => i.blocking)).toHaveLength(0)
    expect(reading.issues.filter(i => !i.blocking)).toHaveLength(9)
  })

  it('reads base amounts and daily codes with semantic contexts and cached formula metadata', () => {
    const buffer = workbookBuffer({
      A_N_B_vol_plein: dailySheet(12.34),
      A_N_B_half_demi: dailySheet(6.17),
      Basisbedragen: basisSheet(43.11),
    }, { sheet: 'A_N_B_vol_plein', address: 'C12', expression: 'ROUND(12.345,2)', cached: 12.35 })
    const result = readWorkbook(buffer)
    expect(result.effectiveFrom).toBe('2026-09-01')
    expect(result.values.find(v => v.table === 'allocation_journaliere_entiere')?.context).toEqual([
      'Allocation entière', 'Werknemers met gezinslast / Travailleurs ayant charge de famille', '1e periode 1ère période', 'Taux source: 65%', 'Tranche: MIN',
    ])
    expect(result.values.find(v => v.table === 'basisbedragen')).toMatchObject({ value: '43.11', unit: 'EUR/day', context: ['base_non_indexee', 'frequence:dag', 'provenance:KB 1'] })
    expect(result.values.find(v => v.source.sheet === 'A_N_B_vol_plein' && v.source.cell === 'C12')?.indexation).toMatchObject({ value: '1.8114', source: { sheet: 'A_N_B_vol_plein', cell: 'W1' } })
    expect(result.issues.filter(i => i.blocking)).toHaveLength(0)
    expect(result.values.find(v => v.source.cell === 'C12')?.source).toMatchObject({ formula: 'ROUND(12.345,2)', raw: '12.35' })
    const moved = readWorkbook(workbookBuffer({
      A_N_B_vol_plein: movedGrid(dailySheet(12.34), 3, 2),
      A_N_B_half_demi: dailySheet(6.17),
      Basisbedragen: movedGrid(basisSheet(43.11), 2, 1),
    }))
    expect(moved.values[0].key).toBe(result.values[0].key)
    expect(moved.values.find(v => v.table === 'basisbedragen')?.key).toBe(result.values.find(v => v.table === 'basisbedragen')?.key)
    expect(moved.issues.filter(i => i.blocking)).toHaveLength(0)
  })

  it('fails closed on unknown units, ambiguous identities and unrecognized A/N/B codes', () => {
    const daily = dailySheet(1)
    daily[8][3] = 'AA1'
    daily[11][3] = 2
    daily[8][20] = 'ZZ9'
    daily[11][20] = 3
    const result = readWorkbook(workbookBuffer({
      A_N_B_vol_plein: daily,
      A_N_B_half_demi: dailySheet(),
      Basisbedragen: basisSheet(43.11, 'onbekend'),
    }))
    expect(result.issues.map(i => i.code)).toContain('unknown_rate_code')
    expect(result.issues.map(i => i.code)).toContain('unknown_basis_unit')
    expect(result.issues.map(i => i.code)).toContain('identity_collision')
    expect(result.issues.filter(i => i.blocking).length).toBeGreaterThan(0)
  })

  it('blocks a formula cell without a cached result', () => {
    const workbook = XLSX.read(workbookBuffer({
      A_N_B_vol_plein: dailySheet(),
      A_N_B_half_demi: dailySheet(),
      Basisbedragen: basisSheet(),
    }), { type: 'buffer', cellFormula: true })
    const formulaCell = workbook.Sheets.A_N_B_vol_plein.C13!
    formulaCell.f = '1+1'
    delete formulaCell.v
    const result = readWorkbookFromParsedWorkbook(workbook)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'formula_without_cached_result', sheet: 'A_N_B_vol_plein', cell: 'C13', blocking: true }))
  })

  it('verifies minimum, maximum tranche, rate codes, base amounts, index values and provenance from the source cells', () => {
    const result = readWorkbook(readFileSync(process.env.DOCBEL_REFERENCE_XLSX ?? fileURLToPath(new URL('./fixtures/barema20260901-new.xlsx', import.meta.url))))
    expect(result.values.find(v => v.source.sheet === 'A_N_B_vol_plein' && v.source.cell === 'C12')).toMatchObject({ code: 'AA1:MIN', category: 'A', value: '78.09', unit: 'EUR/day' })
    expect(result.values.find(v => v.source.sheet === 'A_N_B_half_demi' && v.source.cell === 'C12')).toMatchObject({ code: 'AA1:MIN', category: 'A', value: '39.05', unit: 'EUR/day' })
    expect(result.values.find(v => v.source.sheet === 'A_N_B_vol_plein' && v.source.cell === 'C111')).toMatchObject({ code: 'AA1:99', value: '108.19' })
    expect(result.values.find(v => v.source.sheet === 'A_N_B_half_demi' && v.source.cell === 'C111')).toMatchObject({ code: 'AA1:99', value: '54.4' })
    expect(result.values.find(v => v.source.sheet === 'Basisbedragen' && v.source.cell === 'D27')).toMatchObject({ value: '92.3956', unit: 'EUR/day' })
    expect(result.values.find(v => v.source.sheet === 'Basisbedragen' && v.source.cell === 'I2')).toMatchObject({ table: 'basisbedragen_index', value: '1.8114', unit: 'number' })
    expect(result.values.find(v => v.source.sheet === 'Basisbedragen' && v.source.cell === 'D80')?.context).toContain('provenance:KB 03/05/2007, art. 11, § 1, 3e lid')
  })

  it('blocks incomplete basis, index and tranche identities, duplicate tables, and invalid rate percentages', () => {
    const cases: Array<{ name: string; mutate: (workbook: XLSX.WorkBook) => void; issue: string }> = [
      { name: 'missing final other-section base amount', mutate: workbook => { delete workbook.Sheets.Basisbedragen.D88 }, issue: 'missing_basis_value' },
      { name: 'missing index label', mutate: workbook => { delete workbook.Sheets.Basisbedragen.H2 }, issue: 'unknown_index_identity' },
      { name: 'unknown tranche label', mutate: workbook => { workbook.Sheets.A_N_B_vol_plein.A13 = { t: 's', v: 'X' } }, issue: 'unknown_rate_row_identity' },
      { name: 'duplicate daily table header', mutate: workbook => { workbook.Sheets.A_N_B_vol_plein.A200 = { t: 's', v: 'Code' }; workbook.Sheets.A_N_B_vol_plein['!ref'] = 'A1:W200' }, issue: 'ambiguous_table_header' },
      { name: 'error rate percentage', mutate: workbook => { workbook.Sheets.A_N_B_vol_plein.C11 = { t: 'e', v: 0 } }, issue: 'unknown_rate_percentage' },
      { name: 'missing rate percentage', mutate: workbook => { delete workbook.Sheets.A_N_B_vol_plein.C11 }, issue: 'missing_rate_percentage' },
      { name: 'nonzero unlabelled auxiliary value', mutate: workbook => { workbook.Sheets.A_N_B_half_demi.F12 = { t: 'n', v: 1 } }, issue: 'unmapped_daily_value' },
      { name: 'unrecognized auxiliary formula', mutate: workbook => { workbook.Sheets.A_N_B_half_demi.F12 = { t: 'n', f: 'ROUND(A_N_B_vol_plein!F12/3,2)', v: 0 } }, issue: 'unmapped_daily_value' },
    ]
    for (const testCase of cases) {
      const workbook = referenceWorkbook()
      testCase.mutate(workbook)
      const result = readWorkbookFromParsedWorkbook(workbook)
      expect(result.issues, testCase.name).toContainEqual(expect.objectContaining({ code: testCase.issue, blocking: true }))
    }
  })
})
