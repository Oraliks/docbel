import * as XLSX from 'xlsx'
import type { Coverage, RateValue, ReadingIssue, Source } from '../types'

export type Point = { r: number; c: number }
export const address = (p: Point) => XLSX.utils.encode_cell(p)
export const text = (cell?: XLSX.CellObject): string => cell?.v == null ? '' : String(cell.v).replace(/\s+/g, ' ').trim()
export const semantic = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
export const populated = (cell?: XLSX.CellObject) => !!cell && (cell.v != null || !!cell.f)
export function decimal(cell?: XLSX.CellObject): string | null {
  if (!cell || cell.t !== 'n' || typeof cell.v !== 'number' || !Number.isFinite(cell.v)) return null
  const normalized = Number(cell.v.toPrecision(15)).toString()
  if (!/e/i.test(normalized)) return normalized
  const [mantissa, exponent] = normalized.split('e'), negative = mantissa.startsWith('-'), unsigned = mantissa.replace('-', '')
  const digits = unsigned.replace('.', ''), point = unsigned.split('.')[0].length + Number(exponent)
  const plain = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`
  return negative ? `-${plain}` : plain
}
export function dateValue(cell?: XLSX.CellObject): string | null {
  if (!cell || cell.t === 'e' || cell.v == null) return null
  let y: number, m: number, d: number
  if (cell.t === 'n' && typeof cell.v === 'number') {
    const date = XLSX.SSF.parse_date_code(cell.v)
    if (!date || cell.v <= 0) return null
    ;({ y, m, d } = date)
  } else {
    const match = text(cell).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (!match) return null
    d = Number(match[1]); m = Number(match[2]); y = Number(match[3])
  }
  const utc = new Date(Date.UTC(y, m - 1, d))
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null
}
export type ValueSpec = Omit<RateValue, 'value' | 'source' | 'effectiveFrom'>

/** Only sheet-specific readers assign meanings. This shared layer enforces claims and provenance. */
export class SheetReader {
  readonly sheet: XLSX.WorkSheet
  readonly points: Point[]
  readonly values: RateValue[] = []
  readonly issues: ReadingIssue[] = []
  readonly claimed = new Map<string, 'value' | 'metadata' | 'auxiliary'>()
  readonly effectiveFrom: string | null
  constructor(readonly workbook: XLSX.WorkBook, readonly name: string) {
    this.sheet = workbook.Sheets[name] ?? {}
    const range = XLSX.utils.decode_range(this.sheet['!ref'] ?? 'A1:A1')
    this.points = range.e.r > 500 || range.e.c > 100 ? [] : Object.keys(this.sheet).filter(k => !k.startsWith('!')).map(XLSX.utils.decode_cell).sort((a, b) => a.r - b.r || a.c - b.c)
    if (!workbook.Sheets[name]) this.fail('required_sheet_missing')
    else if (!this.points.length) this.fail('sheet_bounds_exceeded')
    const anchors = this.find(v => semantic(v).includes('geldig/valable'))
    const anchor = anchors.length === 1 ? anchors[0] : null
    const point = anchor ? this.points.find(p => p.c === anchor.c && p.r > anchor.r && populated(this.cell(p))) : null
    this.effectiveFrom = point ? dateValue(this.cell(point)) : null
    if (point) this.claim(point, 'metadata')
    if (!this.effectiveFrom) this.fail('effective_date_unknown', point ?? undefined)
  }
  cell(p: Point): XLSX.CellObject | undefined { return this.sheet[address(p)] }
  str(p: Point) { return text(this.cell(p)) }
  find(test: (value: string, point: Point) => boolean) { return this.points.filter(p => test(this.str(p), p)) }
  one(test: (value: string, point: Point) => boolean, code = 'ambiguous_table_header'): Point | null {
    const matches = this.find(test)
    if (matches.length !== 1) { this.fail(code); return null }
    return matches[0]
  }
  fail(code: string, p?: Point) { this.issues.push({ code, sheet: this.name, ...(p ? { cell: address(p) } : {}), blocking: true }) }
  source(p: Point): Source { const cell = this.cell(p); return { sheet: this.name, cell: address(p), raw: cell?.w ?? text(cell), formula: cell?.f ?? null } }
  claim(p: Point, role: 'metadata' | 'auxiliary') {
    const cell = this.cell(p)
    if (cell?.t === 'e' || cell?.f && cell.v == null) this.fail('formula_without_cached_result', p)
    if (this.claimed.has(address(p)) && this.claimed.get(address(p)) !== role) this.fail('ambiguous_cell_role', p)
    this.claimed.set(address(p), role)
  }
  add(p: Point, spec: ValueSpec) {
    const cell = this.cell(p), value = spec.valueKind === 'expression' && cell?.t === 's' ? text(cell) : decimal(cell)
    if (value === null || !value) { this.fail(cell?.f ? 'formula_without_cached_result' : 'unknown_rate_value', p); return }
    if (this.claimed.has(address(p))) { this.fail('ambiguous_cell_role', p); return }
    this.claimed.set(address(p), 'value')
    this.values.push({ ...spec, value, source: this.source(p), ...(this.effectiveFrom ? { effectiveFrom: this.effectiveFrom } : {}) })
  }
  multiplier(test: (value: string, point: Point) => boolean = value => /multiplicat/i.test(value)): RateValue['indexation'] | undefined {
    const anchor = this.one(test, 'missing_index_multiplier')
    if (!anchor) return
    const candidates = this.points.filter(p => p.r === anchor.r && p.c > anchor.c && populated(this.cell(p)))
    if (candidates.length !== 1 || decimal(this.cell(candidates[0])) === null || Number(this.cell(candidates[0])?.v) <= 0) { this.fail('missing_index_multiplier', anchor); return }
    const point = candidates[0]
    this.claim(point, 'metadata')
    return { value: decimal(this.cell(point))!, source: this.source(point) }
  }
  finish(): Coverage['tables'][number] {
    for (const point of this.points) {
      const cell = this.cell(point)!
      if (!this.claimed.has(address(point)) && (cell.t === 'n' && populated(cell) || cell.t === 'e' || cell.f)) this.fail('unmapped_sheet_value', point)
    }
    const counts = new Map<string, number>()
    for (const value of this.values) counts.set(value.table, (counts.get(value.table) ?? 0) + 1)
    return { sheet: this.name, mappedCells: this.values.length, auxiliaryCells: [...this.claimed.values()].filter(r => r === 'auxiliary').length,
      metadataCells: [...this.claimed.values()].filter(r => r === 'metadata').length, sections: [...counts].map(([id, values]) => ({ id, values })) }
  }
}
