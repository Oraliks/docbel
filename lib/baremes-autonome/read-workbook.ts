import * as XLSX from 'xlsx'
import type { Reading, ReadingIssue, RateValue, Source } from './types'

const REQUIRED = ['A_N_B_vol_plein', 'A_N_B_half_demi', 'Basisbedragen'] as const
const EXPECTED_DAILY_CODES = ['AA1', 'AA2', 'AA3', 'ABAX', 'NA1', 'NA2', 'NA3', 'NBNX', 'BA1', 'BA2', 'BA3', 'BX', 'BB']
const VERSION = 1
type Cell = XLSX.CellObject
type Sheet = XLSX.WorkSheet

const text = (cell: Cell | undefined): string => cell?.v == null ? '' : String(cell.v).replace(/\s+/g, ' ').trim()
const addr = (row: number, col: number) => XLSX.utils.encode_cell({ r: row, c: col })
function decimal(cell: Cell | undefined): string | null {
  if (!cell || cell.t !== 'n' || typeof cell.v !== 'number' || !Number.isFinite(cell.v)) return null
  // Excel stores IEEE numbers; shortest round-trip decimal removes representation noise
  // without rounding the source's significant digits (including four-place base values).
  const normalized = Number(cell.v).toPrecision(15).replace(/(?:\.0+|(?:(\.\d*?)0+))(?=e|$)/, '$1')
  if (!normalized.includes('e')) return normalized
  const [mantissa, exponent] = normalized.split('e')
  const negative = mantissa.startsWith('-')
  const unsigned = mantissa.replace('-', '')
  const digits = unsigned.replace('.', '')
  const point = (unsigned.split('.')[0].length) + Number(exponent)
  const plain = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`
  return negative ? `-${plain}` : plain
}
function source(sheet: string, cell: Cell, address: string): Source {
  return { sheet, cell: address, raw: cell.w ?? String(cell.v), formula: cell.f ? String(cell.f) : null }
}
function dateValue(cell: Cell | undefined): string | null {
  if (!cell) return null
  if (typeof cell.v === 'number') {
    const d = XLSX.SSF.parse_date_code(cell.v)
    if (!d) return null
    return `${String(d.y).padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const raw = text(cell)
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (!m) return null
  const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  return `${String(year).padStart(4, '0')}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
function findEffectiveDate(sheet: Sheet | undefined): string | null {
  if (!sheet) return null
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  if (range.e.r > 500 || range.e.c > 100) return null
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
    if (text(sheet[addr(r, c)]).toLocaleLowerCase().includes('geldig/valable')) return dateValue(sheet[addr(r + 1, c)])
  }
  return null
}
function findBasisDate(sheet: Sheet | undefined): string | null {
  if (!sheet) return null
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  if (range.e.r > 500 || range.e.c > 100) return null
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
    if (text(sheet[addr(r, c)]).toLocaleLowerCase().includes('basisbedragen geldig op')) {
      return dateValue(sheet[addr(r, c + 1)]) ?? dateValue(sheet[addr(r + 1, c)])
    }
  }
  return null
}
function issue(issues: ReadingIssue[], code: string, sheet: string, cell?: string, blocking = true) {
  issues.push({ code, sheet, ...(cell ? { cell } : {}), blocking })
}
function addUnique(values: RateValue[], keys: Set<string>, value: RateValue, issues: ReadingIssue[]) {
  if (keys.has(value.key)) { issue(issues, 'identity_collision', value.source.sheet, value.source.cell); return }
  keys.add(value.key); values.push(value)
}
function heading(sheet: Sheet, row: number, col: number): string {
  for (let c = col; c >= 0; c--) {
    const s = text(sheet[addr(row, c)])
    if (s) return s
  }
  return ''
}
function categoryName(value: string): string | null {
  const v = value.toLocaleLowerCase()
  if (v.includes('charge de famille') || v.includes('gezinslast')) return 'charge_famille'
  if (v.includes('isolé') || v.includes('alleenwon')) return 'isole'
  if (v.includes('cohabitant') || v.includes('samenwon')) return 'cohabitant'
  return null
}
function periodName(first: string, second: string): string | null {
  const v = `${first} ${second}`.toLocaleLowerCase()
  if (/bv-|pp-/.test(v)) return 'periode_bv_moins'
  if (/1e|1ère|première/.test(v)) return 'periode_1'
  if (/2e|2ème|deuxième|bv\+|pp\+/.test(v)) return 'periode_2'
  return null
}
function percent(cell: Cell | undefined): string | null {
  const n = decimal(cell)
  if (!n) return null
  const [whole, fraction = ''] = n.split('.')
  const decimalPosition = whole.length + 2
  const digits = `${whole}${fraction}`.padEnd(decimalPosition, '0')
  const integer = digits.slice(0, decimalPosition).replace(/^0+(?=\d)/, '')
  const remainder = digits.slice(decimalPosition).replace(/0+$/, '')
  return `${integer}${remainder ? `.${remainder}` : ''}%`
}
function parseDaily(sheetName: string, sheet: Sheet, values: RateValue[], keys: Set<string>, issues: ReadingIssue[]) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  if (range.e.r > 500 || range.e.c > 100) { issue(issues, 'sheet_bounds_exceeded', sheetName); return }
  let codeRow = -1, codeHeader = -1
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c <= range.e.c; c++) {
    if (text(sheet[addr(r, c)]).toLocaleLowerCase() === 'code') { codeRow = r; codeHeader = c; break }
  }
  if (codeHeader < 0) { issue(issues, 'missing_code_header', sheetName); return }
  const columns: Array<{ col: number; code: string; category: string; period: string }> = []
  for (let c = codeHeader + 1; c <= range.e.c; c++) {
    const code = text(sheet[addr(codeRow, c)]).replace(/\s+/g, '')
    if (!code) continue
    if (!/^(?:AA[123]|ABAX|NA[123]|NBNX|BA[123]|BX|BB)$/.test(code)) {
      issue(issues, 'unknown_rate_code', sheetName, addr(codeRow, c)); continue
    }
    const categoryHeading = heading(sheet, codeRow - 5, c)
    const periodHeading1 = heading(sheet, codeRow - 3, c), periodHeading2 = heading(sheet, codeRow - 2, c)
    const category = categoryName(categoryHeading)
    const period = periodName(periodHeading1, periodHeading2)
    if (!category || !period) { issue(issues, 'unknown_rate_column_context', sheetName, addr(codeRow, c)); continue }
    columns.push({ col: c, code, category, period })
  }
  if (!columns.length) { issue(issues, 'no_rate_columns', sheetName); return }
  const presentCodes = new Set(columns.map(column => column.code))
  for (const expected of EXPECTED_DAILY_CODES) if (!presentCodes.has(expected)) issue(issues, 'missing_expected_rate_code', sheetName, addr(codeRow, codeHeader))
  const firstDataRow = Array.from({ length: range.e.r - codeRow }, (_, i) => codeRow + i + 1)
    .find(r => text(sheet[addr(r, codeHeader)]).toLocaleUpperCase() === 'MIN')
  if (firstDataRow === undefined) { issue(issues, 'missing_minimum_row', sheetName); return }
  let dataRows = 0
  for (let r = firstDataRow; r <= range.e.r; r++) {
    const rowCodeCell = sheet[addr(r, codeHeader)], rowCode = text(rowCodeCell)
    const hasAmounts = columns.some(c => sheet[addr(r, c.col)]?.v !== undefined)
    if (!rowCode && !hasAmounts) continue
    if (!rowCode) { issue(issues, 'missing_rate_row_identity', sheetName, addr(r, codeHeader)); continue }
    dataRows++
    for (const col of columns) {
      const cellAddr = addr(r, col.col), cell = sheet[cellAddr]
      if (!cell) { issue(issues, 'missing_rate_value', sheetName, cellAddr); continue }
      const value = decimal(cell)
      if (value === null) {
        issue(issues, cell.f ? 'formula_without_cached_result' : 'unknown_rate_value', sheetName, cellAddr)
        continue
      }
      const label = rowCode
      const table = sheetName === 'A_N_B_vol_plein' ? 'allocation_journaliere_entiere' : 'allocation_journaliere_demi'
      const indexedPercent = percent(sheet[addr(codeRow + 1, col.col)]) ?? percent(sheet[addr(codeRow + 2, col.col)])
      const categoryText = heading(sheet, codeRow - 5, col.col).replace(/\s+/g, ' ').trim()
      const periodText = `${heading(sheet, codeRow - 3, col.col)} ${heading(sheet, codeRow - 2, col.col)}`.replace(/\s+/g, ' ').trim()
      addUnique(values, keys, {
        key: `${table}:${col.category}:${col.period}:${col.code}:${label}`, table, code: `${col.code}:${rowCode}`, label,
        category: col.category === 'charge_famille' ? 'A' : col.category === 'isole' ? 'N' : 'B',
        context: [sheetName === 'A_N_B_vol_plein' ? 'Allocation entière' : 'Demi-allocation', categoryText || col.category,
          periodText, ...(indexedPercent ? [`Montant indexé: ${indexedPercent}`] : []), `Tranche: ${rowCode}`], unit: 'EUR/day', value,
        source: source(sheetName, cell, cellAddr),
      }, issues)
    }
  }
  if (dataRows !== 100) issue(issues, 'incomplete_rate_rows', sheetName)
}
function parseBasis(sheet: Sheet, values: RateValue[], keys: Set<string>, issues: ReadingIssue[]) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
  if (range.e.r > 500 || range.e.c > 100) { issue(issues, 'sheet_bounds_exceeded', 'Basisbedragen'); return }
  let headerRow = -1, articleCol = -1, labelCol = -1, amountCol = -1, frequencyCol = -1, referenceCol = -1
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cols = Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => range.s.c + i)
    const article = cols.find(c => text(sheet[addr(r, c)]).toLocaleLowerCase().includes('artikel kb'))
    const label = cols.find(c => text(sheet[addr(r, c)]).toLocaleLowerCase() === 'wat')
    const amount = cols.find(c => text(sheet[addr(r, c)]).toLocaleLowerCase().includes('basisbedrag'))
    if (article === undefined || label === undefined || amount === undefined) continue
    headerRow = r; articleCol = article; labelCol = label; amountCol = amount
    frequencyCol = cols.find(c => text(sheet[addr(r, c)]).toLocaleLowerCase().includes('freq')) ?? -1
    referenceCol = cols.find(c => text(sheet[addr(r, c)]).toLocaleLowerCase().startsWith('zie')) ?? -1
    break
  }
  if (headerRow < 0) { issue(issues, 'missing_basis_headers', 'Basisbedragen'); return }
  let indexHeader = -1, rankCol = -1, indexNameCol = -1, indexValueCol = -1, indexDateCol = -1
  for (let r = range.s.r; r <= range.e.r; r++) for (let c = range.s.c; c < range.e.c - 2; c++) {
    if (text(sheet[addr(r, c)]).toLocaleLowerCase() !== 'rang index' || !text(sheet[addr(r, c + 1)]).toLocaleLowerCase().includes('multiplicator')) continue
    indexHeader = r; rankCol = c; indexNameCol = c + 1; indexValueCol = c + 2; indexDateCol = c + 3
    break
  }
  if (indexHeader < 0) issue(issues, 'missing_index_headers', 'Basisbedragen')
  else for (let r = indexHeader + 1; r <= range.e.r; r++) {
    const name = text(sheet[addr(r, indexNameCol)]), amount = sheet[addr(r, indexValueCol)]
    if (!name) continue
    if (!amount) { issue(issues, 'missing_index_value', 'Basisbedragen', addr(r, indexValueCol)); continue }
    const value = decimal(amount), rank = text(sheet[addr(r, rankCol)]), date = dateValue(sheet[addr(r, indexDateCol)])
    if (value === null) { issue(issues, amount.f ? 'formula_without_cached_result' : 'unknown_rate_value', 'Basisbedragen', addr(r, indexValueCol)); continue }
    if (!date) { issue(issues, 'unknown_index_identity', 'Basisbedragen', addr(r, indexValueCol)); continue }
    const isRankedMultiplier = Boolean(rank)
    addUnique(values, keys, {
      key: `basisbedragen:index:${name.toLocaleLowerCase().replace(/\s+/g, ' ')}`, table: 'basisbedragen_index', code: rank || 'parameter',
      label: name, context: ['indexe', ...(isRankedMultiplier ? [`rang:${rank}`] : ['parametre_indexation']), `date:${date}`], unit: isRankedMultiplier ? 'number' : 'EUR/day', value,
      source: source('Basisbedragen', amount, addr(r, indexValueCol)),
    }, issues)
  }
  let lastArticle = ''
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const amount = sheet[addr(r, amountCol)]
    const label = text(sheet[addr(r, labelCol)])
    const article = text(sheet[addr(r, articleCol)])
    if (article && (label || !amount)) lastArticle = article
    if (!label && !article && !amount) continue
    if (!amount) {
      const frequency = frequencyCol >= 0 ? text(sheet[addr(r, frequencyCol)]) : ''
      if (label && (article || lastArticle) && frequency) issue(issues, 'missing_basis_value', 'Basisbedragen', addr(r, amountCol))
      continue
    }
    const cellAddr = addr(r, amountCol), value = decimal(amount)
    if (value === null) { issue(issues, amount.f ? 'formula_without_cached_result' : 'unknown_rate_value', 'Basisbedragen', cellAddr); continue }
    const effectiveLabel = label || (lastArticle.toLocaleLowerCase() === 'andere' ? article : '')
    const effectiveArticle = label ? lastArticle : lastArticle.toLocaleLowerCase() === 'andere' ? lastArticle : article
    if (!effectiveLabel || !effectiveArticle) { issue(issues, 'unknown_basis_identity', 'Basisbedragen', cellAddr); continue }
    const unitText = frequencyCol >= 0 ? text(sheet[addr(r, frequencyCol)]).toLocaleLowerCase() : ''
    const ratio = /vermenigvuldigingsfactor|pct/i.test(effectiveLabel)
    const unit = ratio ? 'ratio' : unitText === 'dag' ? 'EUR/day' : unitText === 'maand' ? 'EUR/month' : unitText === 'jaar' || unitText === 'uur' ? 'EUR' : null
    if (!unit) { issue(issues, 'unknown_basis_unit', 'Basisbedragen', addr(r, 4)); continue }
    const reference = referenceCol >= 0 ? text(sheet[addr(r, referenceCol)]) : ''
    const basisKey = `${effectiveArticle.toLocaleLowerCase().replace(/\s+/g, ' ')}:${effectiveLabel.toLocaleLowerCase().replace(/\s+/g, ' ')}`
    const fromOtherSection = lastArticle.toLocaleLowerCase() === 'andere' && !label
    const stableBasisKey = fromOtherSection ? `autres:${effectiveLabel.toLocaleLowerCase().replace(/\s+/g, ' ')}` : basisKey
    addUnique(values, keys, {
      key: `basisbedragen:${stableBasisKey}`, table: 'basisbedragen', code: fromOtherSection ? 'autres' : effectiveArticle, label: effectiveLabel,
      context: ['base_non_indexee', `frequence:${unitText}`, ...(ratio && /pct/i.test(effectiveLabel) ? ['unite_source:pourcentage'] : []), ...(reference ? [`provenance:${reference}`] : [])], unit, value,
      source: source('Basisbedragen', amount, cellAddr),
    }, issues)
  }
}

/** Reads the deliberately limited, independent baremes reference workbook. */
export function readWorkbook(buffer: Buffer): Reading {
  return readWorkbookFromParsedWorkbook(XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: false }))
}

/** Pure workbook-object entry point, also used to exercise formula-only cell behavior. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  const values: RateValue[] = [], issues: ReadingIssue[] = [], keys = new Set<string>()
  const sheets = REQUIRED.filter(name => Boolean(workbook.Sheets[name]))
  for (const required of REQUIRED) if (!workbook.Sheets[required]) issue(issues, 'required_sheet_missing', required)
  for (const name of workbook.SheetNames) if (!REQUIRED.includes(name as typeof REQUIRED[number])) issue(issues, 'sheet_not_covered', name, undefined, false)
  for (const name of ['A_N_B_vol_plein', 'A_N_B_half_demi'] as const) {
    const sheet = workbook.Sheets[name]
    if (sheet) parseDaily(name, sheet, values, keys, issues)
  }
  const basis = workbook.Sheets.Basisbedragen
  if (basis) parseBasis(basis, values, keys, issues)
  const effectiveFrom = findEffectiveDate(workbook.Sheets.A_N_B_vol_plein)
  if (!effectiveFrom) issue(issues, 'effective_date_unknown', 'A_N_B_vol_plein', 'A2')
  for (const [name, date] of [
    ['A_N_B_half_demi', findEffectiveDate(workbook.Sheets.A_N_B_half_demi)],
    ['Basisbedragen', findBasisDate(workbook.Sheets.Basisbedragen)],
  ] as const) if (!date || date !== effectiveFrom) issue(issues, 'effective_date_mismatch', name)
  return { effectiveFrom, values, sheets, issues, parserVersion: VERSION }
}
