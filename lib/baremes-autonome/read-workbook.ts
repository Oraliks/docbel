
import type * as XLSX from 'xlsx'
import { readWorkbook as readV1 } from './readers/v1'
import { readWorkbook as readV2 } from './readers/v2'
import { readWorkbook as readV3 } from './readers/v3'
import { readWorkbook as readV4, readWorkbookFromParsedWorkbook as readParsedV4 } from './readers/v4'
import type { Reading } from './types'

export const CURRENT_PARSER_VERSION = 4
export class UnsupportedReaderVersion extends Error {}

/** Readers are immutable by version. Never reinterpret a persisted snapshot with a newer reader. */
export function readWorkbookFromParsedWorkbook(workbook: XLSX.WorkBook): Reading {
  return readParsedV4(workbook)
}
export function readWorkbook(buffer: Buffer): Reading {
  return readWorkbookVersion(buffer, CURRENT_PARSER_VERSION)
}
export function isSupportedReaderVersion(version: number): boolean { return [1,2,3,4].includes(version) }
export function readWorkbookVersion(buffer: Buffer, version: number): Reading {
  if (version === 1) return readV1(buffer)
  if (version === 2) return readV2(buffer)
  if (version === 3) return readV3(buffer)
  if (version === 4) return readV4(buffer)
  throw new UnsupportedReaderVersion(`Unsupported autonomous reader version: ${version}`)
}
