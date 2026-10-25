import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { readWorkbookVersion } from '../read-workbook'
import { readWorkbook, readWorkbookFromParsedWorkbook } from '../readers/v3'
import { compareReadings, digest } from '../compare'
import { SHEETS_V3 } from '../readers/v3'
import { moveSheet } from './workbook-mutations'

const bytes = () => readFileSync('lib/baremes-autonome/__tests__/fixtures/barema20260901-new.xlsx')
const workbook = () => XLSX.read(bytes(), { type: 'buffer', cellFormula: true, cellDates: false })

describe('twelve-sheet independent workbook contract', () => {
  it('reads every real sheet with no hidden unsupported-sheet warning and retains source dates', () => {
    const result = readWorkbook(bytes())
    expect(result.parserVersion).toBe(3)
    expect(result.sheets).toEqual(SHEETS_V3)
    expect(result.coverage?.contractVersion).toBe(2)
    expect(result.coverage?.tables.map(table => table.sheet)).toEqual(SHEETS_V3)
    for (const table of result.coverage!.tables) expect(table.mappedCells).toBe((table.monetaryCells ?? 0) + (table.parameterCells ?? 0) + (table.expressionCells ?? 0))
    expect(result.issues.filter(issue => issue.blocking)).toEqual([])
    expect(result.issues.filter(issue => issue.code === 'sheet_not_covered')).toEqual([])
    expect(new Set(result.values.map(value => value.key)).size).toBe(result.values.length)
    expect(result.values).toHaveLength(6059)
    expect(result.coverage?.auxiliaryCells).toBe(503)
    expect(result.coverage!.tables.reduce((sum, table) => sum + table.monetaryCells!, 0)).toBe(5735)
    expect(result.coverage!.tables.reduce((sum, table) => sum + table.parameterCells!, 0)).toBe(312)
    expect(result.coverage!.tables.reduce((sum, table) => sum + table.expressionCells!, 0)).toBe(12)
    for (const name of SHEETS_V3) expect(result.values.filter(value => value.source.sheet === name).length, name).toBeGreaterThan(0)
    expect(result.values.find(value => value.source.sheet === 'Activering_Activation' && value.source.cell === 'B10')).toMatchObject({ value: '433.81', unit: 'EUR/month', effectiveFrom: '2023-01-01' })
    expect(result.values.find(value => value.source.sheet === 'W ' && value.source.cell === 'P9')).toMatchObject({ value: '73.42', unit: 'EUR/day', effectiveFrom: '2026-09-01' })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'I12')).toMatchObject({ value: '0.2699', unit: 'ratio' })
  })

  it('retains frozen v1/v2 normalization while extending only the current reader', () => {
    for (const version of [1, 2]) {
      const first = readWorkbookVersion(bytes(), version)
      expect(first.parserVersion).toBe(version)
      expect(first.values).toHaveLength(2685)
      expect(first.sheets).toHaveLength(3)
      expect(digest(readWorkbookVersion(bytes(), version))).toBe(digest(first))
    }
    const upgrade = compareReadings(readWorkbookVersion(bytes(), 2), readWorkbook(bytes()))
    expect(upgrade.filter(row => row.before && row.after && row.kind !== 'unchanged')).toHaveLength(0)
  })

  it('blocks each missing sheet, unknown new sheets and unresolved formula references', () => {
    for (const name of SHEETS_V3) {
      const book = workbook()
      delete book.Sheets[name]
      book.SheetNames = book.SheetNames.filter(sheet => sheet !== name)
      expect(readWorkbookFromParsedWorkbook(book).issues, name).toContainEqual(expect.objectContaining({ code: 'required_sheet_missing', sheet: name, blocking: true }))
    }
    const book = workbook()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Unknown amount'], [12.34]]), 'Unidentified')
    expect(readWorkbookFromParsedWorkbook(book).issues).toContainEqual(expect.objectContaining({ code: 'sheet_not_covered', sheet: 'Unidentified', blocking: true }))
    book.Sheets.Bonus.G11 = { t: 'n', f: '#REF!*2', v: 299.53 }
    expect(readWorkbookFromParsedWorkbook(book).issues).toContainEqual(expect.objectContaining({ code: 'formula_reference_invalid', sheet: 'Bonus', cell: 'G11', blocking: true }))
  })

  it('compares date and expression changes without turning missing or text values into zero', () => {
    const original = readWorkbook(bytes())
    const book = workbook()
    book.Sheets.Activering_Activation.J10.v = '501,00 X U/[Sx4] (max. 501,00)'
    const changed = readWorkbookFromParsedWorkbook(book)
    expect(changed.issues.filter(issue => issue.blocking)).toEqual([])
    const differences = compareReadings(original, changed).filter(row => row.kind !== 'unchanged')
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'modified', after: { valueKind: 'expression', value: '501,00 X U/[Sx4] (max. 501,00)' } })
    book.Sheets.Activering_Activation.A2.v = 44928
    const dated = readWorkbookFromParsedWorkbook(book)
    expect(compareReadings(changed, dated).filter(row => row.contextChanged).length).toBeGreaterThan(0)
  })

  it('preserves semantic identities when every added sheet moves with its formula references', () => {
    const original = readWorkbook(bytes())
    for (const name of SHEETS_V3.filter(sheet => !['A_N_B_vol_plein', 'A_N_B_half_demi', 'Basisbedragen'].includes(sheet))) {
      const book = workbook()
      moveSheet(book, name, row => row + 2, col => col + 2)
      const moved = readWorkbookFromParsedWorkbook(book)
      expect(moved.issues.filter(issue => issue.blocking), name).toEqual([])
      expect(compareReadings(original, moved).filter(change => change.kind !== 'unchanged'), name).toEqual([])
    }
  })

  it('rejects unclaimed numbers and invalid source dates rather than treating them as harmless metadata', () => {
    for (const name of SHEETS_V3.filter(sheet => !['A_N_B_vol_plein', 'A_N_B_half_demi', 'Basisbedragen'].includes(sheet))) {
      const book = workbook(), sheet = book.Sheets[name]
      const range = XLSX.utils.decode_range(sheet['!ref']!)
      sheet[XLSX.utils.encode_cell({ r: range.e.r + 1, c: range.e.c + 1 })] = { t: 'n', v: 45292 }
      sheet['!ref'] = XLSX.utils.encode_range({ s: range.s, e: { r: range.e.r + 1, c: range.e.c + 1 } })
      expect(readWorkbookFromParsedWorkbook(book).issues.some(issue => issue.blocking && issue.sheet === name), name).toBe(true)
    }
    const book = workbook()
    book.Sheets.Activering_Activation.A2 = { t: 's', v: '31/02/2023' }
    expect(readWorkbookFromParsedWorkbook(book).issues).toContainEqual(expect.objectContaining({ code: 'effective_date_unknown', sheet: 'Activering_Activation', blocking: true }))
  })

  it('preserves identities after blank row and column insertions inside the nine additional sheets', () => {
    const original = readWorkbook(bytes())
    for (const name of SHEETS_V3.filter(sheet => !['A_N_B_vol_plein', 'A_N_B_half_demi', 'Basisbedragen'].includes(sheet))) {
      const book = workbook()
      moveSheet(book, name, row => row >= 8 ? row + 1 : row, col => col >= 4 ? col + 1 : col)
      const moved = readWorkbookFromParsedWorkbook(book)
      expect(moved.issues.filter(issue => issue.blocking), name).toEqual([])
      expect(compareReadings(original, moved).filter(change => change.kind !== 'unchanged'), name).toEqual([])
    }
  })

  it('locates allocation, category and percentage headings across inserted blank header rows', () => {
    const original = readWorkbook(bytes())
    for (const name of ['TW-CT_JS', 'SpecCat']) {
      const book = workbook()
      const codeRow = () => XLSX.utils.decode_cell(Object.keys(book.Sheets[name]).find(cell => book.Sheets[name][cell]?.v === 'Code')!).r
      let start = codeRow()
      moveSheet(book, name, row => row >= start ? row + 1 : row, col => col)
      start = codeRow() + 1
      moveSheet(book, name, row => row >= start ? row + 1 : row, col => col)
      const moved = readWorkbookFromParsedWorkbook(book)
      expect(moved.issues.filter(issue => issue.blocking), name).toEqual([])
      expect(compareReadings(original, moved).filter(change => change.kind !== 'unchanged'), name).toEqual([])
    }
    const missing = workbook()
    delete missing.Sheets.SpecCat.C5
    expect(readWorkbookFromParsedWorkbook(missing).issues).toContainEqual(expect.objectContaining({ code: 'unknown_special_category_context', sheet: 'SpecCat', blocking: true }))
  })
})
