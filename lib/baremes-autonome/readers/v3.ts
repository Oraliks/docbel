import * as XLSX from 'xlsx'
import { readWorkbookFromParsedWorkbook as readParsedV2 } from './v2'
import { parseMatrices } from './v3-matrices'
import { parseOther } from './v3-other'
import type { Coverage, RateValue, Reading } from '../types'

export const SHEETS_V3 = ['A_N_B_vol_plein', 'A_N_B_half_demi', 'TW-CT_JS', 'SpecCat', 'Loonschijven_Tranches salariale', 'Uurlonen_Salaires horaires', 'W ', 'AndereBedrWLH_AutresMontCHOM', 'Activering_Activation', 'AndereUitk_AutresAlloc', 'Bonus', 'Basisbedragen'] as const

/** Reader v3 owns twelve sheet contracts. Published v1/v2 snapshots retain their frozen readers. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  const original = readParsedV2(workbook)
  const matrices = parseMatrices(workbook), other = parseOther(workbook)
  const issues = [...original.issues.filter(i => i.code !== 'sheet_not_covered'), ...matrices.issues, ...other.issues]
  for (const name of SHEETS_V3) if (!workbook.Sheets[name] && !issues.some(issue => issue.code === 'required_sheet_missing' && issue.sheet === name)) issues.push({ code: 'required_sheet_missing', sheet: name, blocking: true })
  for (const name of workbook.SheetNames) if (!(SHEETS_V3 as readonly string[]).includes(name)) issues.push({ code: 'sheet_not_covered', sheet: name, blocking: true })
  for (const name of SHEETS_V3) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    for (const [cell, value] of Object.entries(sheet)) {
      if (cell.startsWith('!') || typeof value?.f !== 'string') continue
      const formula = value.f as string
      const references = [...formula.matchAll(/(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_ .-]*))!/g)].map(match => (match[1] ?? match[2]).replaceAll("''", "'"))
      if (/#REF!|\[[^\]]+\]/i.test(formula) || references.some(reference => !workbook.Sheets[reference])) issues.push({ code: 'formula_reference_invalid', sheet: name, cell, blocking: true })
    }
  }
  const parsedValues = [...original.values.map((value): RateValue => ({ ...value,
    unit: value.unit === 'EUR' && value.context.includes('frequence:jaar') ? 'EUR/year' : value.unit === 'EUR' && value.context.includes('frequence:uur') ? 'EUR/hour' : value.unit,
    ...(original.effectiveFrom ? { effectiveFrom: value.context.find(c => /^date:\d{4}-\d{2}-\d{2}$/.test(c))?.slice(5) ?? original.effectiveFrom } : {}),
  })), ...matrices.values, ...other.values]
  const keys = new Set<string>()
  const collisions = new Set<string>()
  for (const value of parsedValues) {
    if (keys.has(value.key)) { collisions.add(value.key); issues.push({ code: 'identity_collision', sheet: value.source.sheet, cell: value.source.cell, blocking: true }) }
    keys.add(value.key)
  }
  // Do not pick an arbitrary claimant, and keep the blocked workspace consultable.
  const values = parsedValues.filter(value => !collisions.has(value.key))
  const tables = [...(original.coverage?.tables ?? []), ...matrices.coverage, ...other.coverage].map(table => {
    const mapped = values.filter(value => value.source.sheet === table.sheet)
    return { ...table, mappedCells: mapped.length, monetaryCells: mapped.filter(value => !value.valueKind && value.unit.startsWith('EUR')).length,
      parameterCells: mapped.filter(value => !value.valueKind && !value.unit.startsWith('EUR')).length, expressionCells: mapped.filter(value => value.valueKind === 'expression').length }
  })
  const coverage: Coverage = { contractVersion: 2, auxiliaryCells: tables.reduce((sum, table) => sum + table.auxiliaryCells, 0), tables: tables.sort((a, b) => SHEETS_V3.indexOf(a.sheet as typeof SHEETS_V3[number]) - SHEETS_V3.indexOf(b.sheet as typeof SHEETS_V3[number])) }
  return { ...original, parserVersion: 3, identityVersion: 1, values, issues, coverage, sheets: SHEETS_V3.filter(name => !!workbook.Sheets[name]) }
}
export function readWorkbook(buffer: Buffer): Reading {
  return readWorkbookFromParsedWorkbook(XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: false }))
}
