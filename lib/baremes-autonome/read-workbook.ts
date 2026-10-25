
import type * as XLSX from 'xlsx'
import { readWorkbook as readV1 } from './readers/v1'
import { readWorkbook as readV2 } from './readers/v2'
import { readWorkbook as readV3, readWorkbookFromParsedWorkbook as readParsedV3 } from './readers/v3'
import type { Reading } from './types'

export const CURRENT_PARSER_VERSION = 3
export class UnsupportedReaderVersion extends Error {}

/** Readers are immutable by version. Never reinterpret a persisted snapshot with a newer reader. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  return readParsedV3(workbook)
}
export function readWorkbook(buffer: Buffer): Reading {
  return readWorkbookVersion(buffer, CURRENT_PARSER_VERSION)
}
export function isSupportedReaderVersion(version: number): boolean { return version === 1 || version === 2 || version === 3 }
export function readWorkbookVersion(buffer: Buffer, version: number): Reading {
  if (version === 1) return readV1(buffer)
  if (version === 2) return readV2(buffer)
  if (version === 3) return readV3(buffer)
  throw new UnsupportedReaderVersion(`Unsupported autonomous reader version: ${version}`)
}
