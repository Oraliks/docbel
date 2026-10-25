import * as XLSX from 'xlsx'
import type { Coverage, RateValue, ReadingIssue } from '../types'
import { readOtherSheet } from './v3-other-sections'

const SUPPORTED_SHEETS = ['W ', 'AndereBedrWLH_AutresMontCHOM', 'Activering_Activation', 'AndereUitk_AutresAlloc', 'Bonus'] as const

/** Reads only the additional tables owned by the independent autonomous-rates reader. */
export function parseOther(workbook: XLSX.WorkBook): { values: RateValue[]; issues: ReadingIssue[]; coverage: Coverage['tables'] } {
  const values: RateValue[] = []
  const issues: ReadingIssue[] = []
  const coverage: Coverage['tables'] = []
  for (const name of SUPPORTED_SHEETS) {
    if (!workbook.Sheets[name]) continue
    const result = readOtherSheet(workbook, name)
    if (!result) continue
    values.push(...result.values)
    issues.push(...result.issues)
    coverage.push(result.coverage)
  }
  return { values, issues, coverage }
}
