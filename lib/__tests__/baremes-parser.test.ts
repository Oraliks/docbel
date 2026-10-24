import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseBaremaFile } from '../baremes-parser'

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

describe('parseBaremaFile', () => {
  it('conserve une date d’effet officielle affichée avec des barres', () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([['1/09/2026']])
    XLSX.utils.book_append_sheet(workbook, sheet, 'Basisbedragen')
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)

    const parsed = parseBaremaFile(toArrayBuffer(buffer))

    expect(parsed.fileMetadata.effectiveDate).toBe('1/09/2026')
  })

  it('conserve les formules Excel séparément des valeurs mises en cache', () => {
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([['Montant', 'Calcul'], [1.5, 0.75]])
    sheet.B2 = { t: 'n', v: 0.75, f: 'ROUND(A2/2,2)' }
    XLSX.utils.book_append_sheet(workbook, sheet, 'Formules')
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)

    const parsed = parseBaremaFile(toArrayBuffer(buffer))

    expect(parsed.sheets[0].formulaData?.B2).toBe('ROUND(A2/2,2)')
    expect(parsed.sheets[0].cellData[1][1]).toBe('0.75')
  })
})
