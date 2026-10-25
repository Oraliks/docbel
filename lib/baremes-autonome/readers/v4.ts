import * as XLSX from 'xlsx'
import { readWorkbookFromParsedWorkbook as readV3, SHEETS_V3 } from './v3'
import { address, dateValue, populated, text } from './v3-common'
import type { Reading, ReadingIssue } from '../types'
import type { ScopeEvidence } from '../review-types'
import { readEvolvingSheet } from './v4-sections'

// These diagnostics describe a missing known member, never an unreadable present value.
const MISSING_MEMBERS = new Set([
  'incomplete_rate_rows',
  'incomplete_rate_identities',
  'missing_expected_rate_code',
  'missing_or_duplicate_daily_series',
  'unknown_or_missing_daily_column',
  'incomplete_special_identities',
  'incomplete_special_series',
  'missing_or_duplicate_special_series',
  'unknown_or_missing_special_column',
  'missing_salary_code',
  'missing_hourly_code',
  'missing_activation_identity',
])

function evidence(workbook: XLSX.WorkBook, sheet: string): ScopeEvidence {
  const data = workbook.Sheets[sheet]
  const headers = data
    ? Object.keys(data)
        .filter((cell) => !cell.startsWith('!'))
        .map((cell) => ({ cell, value: data[cell] as XLSX.CellObject }))
        .filter(({ cell, value }) => XLSX.utils.decode_cell(cell).r < 12 && value.t === 's')
        .slice(0, 40)
        .map(({ cell, value }) => ({ sheet, cell, raw: text(value), formula: value.f ?? null }))
    : []
  return {
    sheet,
    state: data ? 'read' : workbook.SheetNames.includes(sheet) ? 'unreadable' : 'absent',
    region: data?.['!ref'] ?? null,
    headers,
    presentSheets: [...workbook.SheetNames],
    occupiedCells: data
      ? Object.keys(data).filter((cell) => !cell.startsWith('!') && populated(data[cell]))
      : [],
  }
}
function knownHourlySubset(workbook: XLSX.WorkBook, sheet: string) {
  const data = workbook.Sheets[sheet]
  const header = data && Object.keys(data).find((cell) => text(data[cell]).toLowerCase() === 'code')
  if (!header) return false
  const row = XLSX.utils.decode_cell(header).r,
    col = XLSX.utils.decode_cell(header).c
  const values = Object.keys(data)
    .filter((cell) => !cell.startsWith('!'))
    .map((cell) => ({ p: XLSX.utils.decode_cell(cell), cell: data[cell] as XLSX.CellObject }))
    .filter(({ p, cell }) => p.r === row && p.c > col && populated(cell))
    .map(({ cell }) => Number(cell.v))
  return (
    values.length > 0 &&
    new Set(values).size === values.length &&
    values.every((value) => value >= 35 && value <= 40 && Number.isInteger(value * 2))
  )
}
function absentActivationSection(workbook: XLSX.WorkBook) {
  const data = workbook.Sheets.Activering_Activation
  if (!data) return false
  const cells = Object.keys(data)
    .filter((cell) => !cell.startsWith('!'))
    .map((cell) => text(data[cell]))
  return (
    (!cells.some((value) => /WALLONIE/i.test(value)) && !cells.some((value) => /W[AB][123]/.test(value))) ||
    (!cells.some((value) => /BRUSSEL|BRUXELLES/i.test(value)) &&
      !cells.some((value) => /B[AB][123]/.test(value)))
  )
}

/** Version 4 keeps the v3 extraction, but records proved scope changes separately from corruption. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  const reading = readV3(workbook)
  for (const name of ['Bonus', 'AndereBedrWLH_AutresMontCHOM'])
    if (workbook.Sheets[name]) {
      const replacement = readEvolvingSheet(workbook, name)
      reading.values = [
        ...reading.values.filter((value) => value.source.sheet !== name),
        ...replacement.values,
      ]
      reading.issues = [
        ...reading.issues.filter(
          (issue) => issue.sheet !== name || issue.code === 'formula_reference_invalid',
        ),
        ...replacement.issues,
      ]
      if (reading.coverage) {
        const mapped = replacement.values
        reading.coverage.tables = reading.coverage.tables.map((table) =>
          table.sheet === name
            ? {
                ...replacement.coverage,
                monetaryCells: mapped.filter((value) => !value.valueKind && value.unit.startsWith('EUR'))
                  .length,
                parameterCells: mapped.filter((value) => !value.valueKind && !value.unit.startsWith('EUR'))
                  .length,
                expressionCells: mapped.filter((value) => value.valueKind === 'expression').length,
              }
            : table,
        )
      }
    }
  const scope = SHEETS_V3.map((sheet) => evidence(workbook, sheet))
  const issues: ReadingIssue[] = reading.issues.map((issue) => {
    const missingSheet =
      !workbook.Sheets[issue.sheet] &&
      !workbook.SheetNames.includes(issue.sheet) &&
      (SHEETS_V3 as readonly string[]).includes(issue.sheet)
    const observed = reading.values.some((value) => value.source.sheet === issue.sheet)
    const missingMember =
      observed &&
      (MISSING_MEMBERS.has(issue.code) ||
        (issue.code === 'missing_supported_rate_identity' && !issue.cell) ||
        (issue.code === 'missing_unit_header' && issue.sheet === 'AndereBedrWLH_AutresMontCHOM') ||
        (issue.code === 'unknown_or_missing_hourly_hours' && knownHourlySubset(workbook, issue.sheet)) ||
        (issue.code === 'incomplete_activation_tables' && absentActivationSection(workbook)))
    if (
      (missingSheet &&
        ['required_sheet_missing', 'sheet_bounds_exceeded', 'effective_date_unknown'].includes(issue.code)) ||
      missingMember
    )
      return { ...issue, blocking: false, observation: 'scope' }
    return issue
  })
  // A removed primary sheet must not erase the dates carried by other complete sheets.
  let effectiveFrom = reading.effectiveFrom
  if (!workbook.Sheets.A_N_B_vol_plein) {
    const dates = scope
      .filter((item) => item.state === 'read' && item.sheet !== 'Activering_Activation')
      .flatMap((item) => {
        const data = workbook.Sheets[item.sheet]
        const anchor = Object.keys(data).find(
          (cell) =>
            !cell.startsWith('!') && /geldig\/valable|basisbedragen geldig op/i.test(text(data[cell])),
        )
        if (!anchor) return []
        const p = XLSX.utils.decode_cell(anchor)
        const date =
          dateValue(data[address({ r: p.r + 1, c: p.c })]) ?? dateValue(data[address({ r: p.r, c: p.c + 1 })])
        return date ? [date] : []
      })
    if (dates.length && new Set(dates).size === 1) {
      effectiveFrom = dates[0]
      for (const issue of issues)
        if (issue.code === 'effective_date_mismatch') {
          issue.blocking = false
          issue.observation = 'scope'
        }
    }
  }
  for (const observation of scope)
    if (issues.some((issue) => issue.sheet === observation.sheet && issue.blocking))
      observation.state = 'unreadable'
  return { ...reading, parserVersion: 4, issues, scope, effectiveFrom }
}
export function readWorkbook(bytes: Buffer): Reading {
  return readWorkbookFromParsedWorkbook(
    XLSX.read(bytes, { type: 'buffer', cellFormula: true, cellDates: false }),
  )
}
