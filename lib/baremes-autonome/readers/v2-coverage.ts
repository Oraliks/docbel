import * as XLSX from 'xlsx'
import type { Coverage, Reading, ReadingIssue, Source } from '../types'

type Point = { r: number; c: number }
const address = (p: Point) => XLSX.utils.encode_cell(p)
const text = (c?: XLSX.CellObject): string => c?.v == null ? '' : String(c.v).replace(/\s+/g, ' ').trim()
const populated = (c?: XLSX.CellObject) => !!c && (c.v != null || !!c.f)
const numeric = (c?: XLSX.CellObject): c is XLSX.CellObject & { v: number } => !!c && c.t === 'n' && typeof c.v === 'number' && Number.isFinite(c.v)
const codes = ['AA1', 'AA2', 'AA3', 'ABAX', 'NA1', 'NA2', 'NA3', 'NBNX', 'BA1', 'BA2', 'BA3', 'BX', 'BB']
const percentageCodes = new Set(['AA1', 'AA2', 'AA3', 'NA1', 'NA2', 'NA3', 'BA1', 'BA2', 'BA3'])

/** Coverage contract 1: coded MIN/1..99 matrices and the labelled base/index tables. */
export function validateCoverage(workbook: XLSX.WorkBook, reading: Reading) {
  const issues: ReadingIssue[] = []
  const multipliers: Record<string, { value: string; source: Source }> = {}
  const coverage: Coverage = { contractVersion: 1, auxiliaryCells: 0, tables: [] }
  const fail = (code: string, sheet: string, point?: Point) => issues.push({ code, sheet, ...(point ? { cell: address(point) } : {}), blocking: true })
  const points = (sheet: XLSX.WorkSheet): Point[] => {
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:A1')
    return range.e.r > 500 || range.e.c > 100 ? [] : Object.keys(sheet).filter(key => !key.startsWith('!')).map(XLSX.utils.decode_cell)
  }
  const find = (s: XLSX.WorkSheet, test: (v: string) => boolean) => points(s).filter(p => test(text(s[address(p)]).toLowerCase()))
  const whole = workbook.Sheets.A_N_B_vol_plein
  const wholeHeaders = whole ? find(whole, value => value === 'code') : []
  const wholeRange = whole ? XLSX.utils.decode_range(whole['!ref'] ?? 'A1:A1') : null
  if (workbook.Workbook?.WBProps?.date1904) fail('unsupported_date_system', '')

  for (const name of ['A_N_B_vol_plein', 'A_N_B_half_demi']) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const headers = find(sheet, value => value === 'code')
    if (headers.length !== 1) { fail('ambiguous_table_header', name); continue }
    const header = headers[0]
    const columns = points(sheet).filter(p => p.r === header.r && p.c > header.c && text(sheet[address(p)]))
    const codedColumns = new Set(columns.map(p => p.c))
    const minimum = points(sheet).find(p => p.c === header.c && p.r > header.r && text(sheet[address(p)]) === 'MIN')
    if (!minimum) continue // the frozen reader already emits a blocking issue
    const metadataCells = new Set<string>()
    const rows = points(sheet).filter(p => p.c === header.c && p.r >= minimum.r && populated(sheet[address(p)]))
    const identities = new Set(rows.map(p => text(sheet[address(p)])))
    for (const id of ['MIN', ...Array.from({ length: 99 }, (_, i) => String(i + 1))]) if (!identities.has(id)) fail('incomplete_rate_identities', name, header)
    for (const row of rows) if (text(sheet[address(row)]) !== 'MIN' && !/^(?:[1-9]|[1-9][0-9])$/.test(text(sheet[address(row)]))) fail('unknown_rate_row_identity', name, row)
    for (const column of columns) {
      const code = text(sheet[address(column)]).replace(/\s+/g, '')
      if (!codes.includes(code)) continue
      const rates = [header.r + 1, header.r + 2].map(r => ({ point: { r, c: column.c }, cell: sheet[address({ r, c: column.c })] })).filter(v => populated(v.cell))
      for (const rate of rates) metadataCells.add(address(rate.point))
      if (percentageCodes.has(code) && !rates.length) fail('missing_rate_percentage', name, column)
      for (const rate of rates) if (!numeric(rate.cell) || rate.cell.v < 0 || rate.cell.v > 1) fail('unknown_rate_percentage', name, rate.point)
      if (rates.length === 2 && rates[0].cell?.v !== rates[1].cell?.v) fail('ambiguous_rate_percentage', name, column)
      const category = ['AA1', 'AA2', 'AA3', 'ABAX'].includes(code) ? 'A' : ['NA1', 'NA2', 'NA3', 'NBNX'].includes(code) ? 'N' : 'B'
      const period = code === 'BB' ? 'periode_bv_moins' : ['ABAX', 'NBNX', 'BX'].includes(code) ? 'periode_2' : 'periode_1'
      for (const value of reading.values.filter(v => v.source.sheet === name && v.code.startsWith(`${code}:`))) {
        if (value.category !== category || value.key.split(':')[2] !== period) { fail('unknown_rate_column_context', name, column); break }
      }
    }
    const anchors = find(sheet, value => value.includes('multiplicat'))
    if (anchors.length !== 1) fail('missing_index_multiplier', name)
    else {
      const anchor = anchors[0]
      const candidates = [1, 2, 3].map(offset => ({ r: anchor.r, c: anchor.c + offset })).filter(p => populated(sheet[address(p)]))
      const point = candidates[0], cell = point ? sheet[address(point)] : undefined
      if (candidates.length !== 1 || !numeric(cell) || cell.v <= 0) fail('missing_index_multiplier', name, anchor)
      else {
        metadataCells.add(address(point))
        multipliers[name] = { value: Number(cell.v.toPrecision(15)).toString(), source: { sheet: name, cell: address(point), raw: cell.w ?? String(cell.v), formula: cell.f ?? null } }
      }
    }
    let auxiliaryCells = 0
    for (const point of points(sheet).filter(p => p.r >= minimum.r && p.c !== header.c && !codedColumns.has(p.c))) {
      const cell = sheet[address(point)]
      if (!populated(cell)) continue
      const match = cell.f?.match(/^ROUND\((?:'A_N_B_vol_plein'|A_N_B_vol_plein)!\$?([A-Z]+)\$?(\d+)\/2,2\)$/i)
      const target = match ? XLSX.utils.decode_cell(`${match[1]}${match[2]}`) : null
      const validTarget = target && whole && wholeHeaders.length === 1 && wholeRange && target.r <= wholeRange.e.r && target.c <= wholeRange.e.c
        && !populated(whole[address(target)]) && !text(whole[address({ r: wholeHeaders[0].r, c: target.c })])
        && text(whole[address({ r: target.r, c: wholeHeaders[0].c })]) === text(sheet[address({ r: point.r, c: header.c })])
      if (name === 'A_N_B_half_demi' && numeric(cell) && cell.v === 0 && validTarget) auxiliaryCells++
      else fail('unmapped_daily_value', name, point)
    }
    coverage.auxiliaryCells += auxiliaryCells
    coverage.tables.push({ sheet: name, mappedCells: reading.values.filter(v => v.source.sheet === name).length, auxiliaryCells })
    const dates = find(sheet, value => value.includes('geldig/valable'))
    if (dates.length !== 1) fail('effective_date_unknown', name)
    for (const anchor of dates) {
      const point = { r: anchor.r + 1, c: anchor.c }
      metadataCells.add(address(point))
      if (sheet[address(point)]?.t === 'e') fail('effective_date_unknown', name, point)
    }
    for (const point of points(sheet).filter(p => p.r < minimum.r)) {
      const cell = sheet[address(point)]
      if (!metadataCells.has(address(point)) && (numeric(cell) || cell.t === 'e')) fail('unmapped_daily_value', name, point)
    }
  }

  const basis = workbook.Sheets.Basisbedragen
  if (basis) {
    const primary = find(basis, value => value.includes('artikel kb'))
    const index = find(basis, value => value === 'rang index')
    if (primary.length !== 1 || index.length !== 1) fail('ambiguous_table_header', 'Basisbedragen')
    else {
      const range = XLSX.utils.decode_range(basis['!ref'] ?? 'A1:A1'), main = primary[0], idx = index[0]
      const column = (test: (s: string) => boolean) => points(basis).find(p => p.r === main.r && test(text(basis[address(p)]).toLowerCase()))?.c
      const labelCol = column(s => s === 'wat'), amountCol = column(s => s.includes('basisbedrag')), frequencyCol = column(s => s.includes('freq'))
      const referenceCol = column(s => s.startsWith('zie'))
      if (labelCol === undefined || amountCol === undefined || frequencyCol === undefined) fail('missing_basis_headers', 'Basisbedragen')
      else for (let r = main.r + 1; r <= Math.min(range.e.r, 500); r++) {
        const article = text(basis[address({ r, c: main.c })]), label = text(basis[address({ r, c: labelCol })])
        const frequency = text(basis[address({ r, c: frequencyCol })]), amount = basis[address({ r, c: amountCol })]
        if ((label || article && article.toLowerCase() !== 'andere' || frequency) && !populated(amount)) fail('missing_basis_value', 'Basisbedragen', { r, c: amountCol })
        if (populated(amount) && !label && !article) fail('unknown_basis_identity', 'Basisbedragen', { r, c: amountCol })
      }
      for (let r = idx.r + 1; r <= Math.min(range.e.r, 500); r++) {
        const cells = [0, 1, 2, 3].map(offset => basis[address({ r, c: idx.c + offset })])
        if (!text(cells[1]) && cells.some(populated)) fail('unknown_index_identity', 'Basisbedragen', { r, c: idx.c + 1 })
        if (text(cells[1]) && (!numeric(cells[2]) || cells[1]?.t !== 's' || cells[3]?.t === 'e'
          || populated(cells[0]) && (!numeric(cells[0]) || !Number.isInteger(cells[0].v) || cells[0].v < 0))) fail('unknown_index_identity', 'Basisbedragen', { r, c: idx.c + 1 })
        if (text(cells[1]) && !populated(cells[0]) && !['daggrens gedeeltelijke indexering', 'daggrens gedeeltelijke indexering a6/a0h', 'maximale indexering', 'maximale indexering a6/a0h'].includes(text(cells[1]).toLowerCase())) fail('unknown_index_identity', 'Basisbedragen', { r, c: idx.c + 1 })
      }
      // Nothing numeric may hide in a new column beside the supported base/index tables.
      const mainColumns = new Set([main.c, labelCol, labelCol === undefined ? undefined : labelCol + 1, amountCol, frequencyCol, referenceCol])
      const indexColumns = new Set([idx.c, idx.c + 1, idx.c + 2, idx.c + 3])
      const dateAnchors = find(basis, value => value.includes('basisbedragen geldig op'))
      if (dateAnchors.length !== 1) fail('effective_date_unknown', 'Basisbedragen')
      for (const anchor of dateAnchors) {
        const candidates = [{ r: anchor.r, c: anchor.c + 1 }, { r: anchor.r + 1, c: anchor.c }].filter(p => populated(basis[address(p)]))
        if (candidates.length !== 1 || basis[address(candidates[0])]?.t === 'e') fail('effective_date_unknown', 'Basisbedragen', anchor)
      }
      const dateCells = new Set(dateAnchors.flatMap(p => [address(p), address({ r: p.r, c: p.c + 1 }), address({ r: p.r + 1, c: p.c })]))
      for (const point of points(basis)) {
        const cell = basis[address(point)]
        const inIndex = indexColumns.has(point.c) && point.r >= idx.r
        const inMain = mainColumns.has(point.c) && point.r >= main.r
        if (!inIndex && !inMain && !dateCells.has(address(point)) && populated(cell)) fail('unmapped_basis_value', 'Basisbedragen', point)
        if (point.r > main.r && point.c === (labelCol ?? -2) + 1 && point.c !== amountCol && numeric(cell)) fail('unmapped_basis_value', 'Basisbedragen', point)
      }
    }
    coverage.tables.push({ sheet: 'Basisbedragen', mappedCells: reading.values.filter(v => v.source.sheet === 'Basisbedragen').length, auxiliaryCells: 0 })
  }
  return { issues, coverage, multipliers }
}
