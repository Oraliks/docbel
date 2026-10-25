import * as XLSX from 'xlsx'
import { readWorkbookFromParsedWorkbook as readParsedV1 } from './v1'
import { validateCoverage } from './v2-coverage'
import type { Reading } from '../types'

/** Frozen reader v2 and coverage contract 1. Evolve by adding v3, never changing v2. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  const reading = readParsedV1(workbook)
  const checked = validateCoverage(workbook, reading)
  return { ...reading, parserVersion: 2, identityVersion: 1,
    issues: [...reading.issues, ...checked.issues], coverage: checked.coverage,
    values: reading.values.map(value => ({ ...value,
      context: value.context.map(context => context.replace(/^Montant indexé:/, 'Taux source:')),
      ...(checked.multipliers[value.source.sheet] ? { indexation: checked.multipliers[value.source.sheet] } : {}),
    })),
  }
}
export function readWorkbook(buffer: Buffer): Reading {
  return readWorkbookFromParsedWorkbook(XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: false }))
}
