import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { parseOther } from '../readers/v3-other'

function reference() {
  const path = fileURLToPath(new URL('./fixtures/barema20260901-new.xlsx', import.meta.url))
  return XLSX.read(readFileSync(path), { type: 'buffer', cellFormula: true, cellDates: false })
}

function shiftGrid(workbook: XLSX.WorkBook, name: string) {
  const source = workbook.Sheets[name]
  const oldRange = XLSX.utils.decode_range(source['!ref'] ?? 'A1:A1')
  const splitRow = oldRange.s.r + Math.floor((oldRange.e.r - oldRange.s.r) / 2)
  const cells = Object.entries(source).filter(([key]) => !key.startsWith('!'))
  const cellAt = (address: string) => source[address]?.v == null ? '' : String(source[address].v).trim().toLowerCase()
  const splitCol = name === 'W '
    ? cells.map(([key]) => XLSX.utils.decode_cell(key)).find(p => cellAt(XLSX.utils.encode_cell(p)).includes('leeftijd'))!.c + 1
    : name === 'AndereBedrWLH_AutresMontCHOM'
      ? cells.map(([key]) => XLSX.utils.decode_cell(key)).find(p => cellAt(XLSX.utils.encode_cell(p)) === 'uitleg - explications')!.c + 1
      : name === 'Activering_Activation'
        ? cells.map(([key]) => XLSX.utils.decode_cell(key)).filter(p => cellAt(XLSX.utils.encode_cell(p)) === 'code').sort((a, b) => a.c - b.c)[0].c + 1
        : cells.map(([key]) => XLSX.utils.decode_cell(key)).find(p => cellAt(XLSX.utils.encode_cell(p)) === 's')!.c + 1
  const moveAddress = (value: string) => {
    const match = value.match(/^(\$?)([A-Z]{1,3})(\$?)(\d+)$/i)
    if (!match) return value
    const old = XLSX.utils.decode_cell(`${match[2]}${match[4]}`)
    old.r += 2 + (old.r >= splitRow ? 1 : 0)
    old.c += 3 + (old.c >= splitCol ? 1 : 0)
    return `${match[1]}${XLSX.utils.encode_col(old.c)}${match[3]}${old.r + 1}`
  }
  const transformFormula = (formula: string, ownerSheet: string) => {
    const qualified = /'([^']+)'!(\$?[A-Z]{1,3}\$?\d+)|\b([A-Za-z_][A-Za-z0-9_]*)!(\$?[A-Z]{1,3}\$?\d+)/g
    let transformed = formula.replace(qualified, (match, quotedSheet: string, quotedAddress: string, plainSheet: string, plainAddress: string) => {
      const referencedSheet = quotedSheet ?? plainSheet
      if (referencedSheet !== name) return match
      return `${quotedSheet ? `'${quotedSheet}'` : plainSheet}!${moveAddress(quotedAddress ?? plainAddress)}`
    })
    if (ownerSheet === name) transformed = transformed.replace(/(?<![A-Za-z0-9_!'])\$?[A-Z]{1,3}\$?\d+/gi, moveAddress)
    return transformed
  }
  for (const [sheetName, worksheet] of Object.entries(workbook.Sheets)) {
    for (const [key, cell] of Object.entries(worksheet)) {
      if (key.startsWith('!') || !cell?.f) continue
      worksheet[key] = { ...cell, f: transformFormula(String(cell.f), sheetName) }
    }
  }
  const shifted: XLSX.WorkSheet = {}
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('!')) continue
    const cell = XLSX.utils.decode_cell(key)
    const row = cell.r + 2 + (cell.r >= splitRow ? 1 : 0)
    const col = cell.c + 3 + (cell.c >= splitCol ? 1 : 0)
    shifted[XLSX.utils.encode_cell({ r: row, c: col })] = value
  }
  for (const [key, value] of Object.entries(source)) if (key.startsWith('!') && key !== '!ref') shifted[key] = value
  const start = { r: oldRange.s.r + 2, c: oldRange.s.c + 3 }
  const end = { r: oldRange.e.r + 2 + (oldRange.e.r >= splitRow ? 1 : 0), c: oldRange.e.c + 3 + (oldRange.e.c >= splitCol ? 1 : 0) }
  shifted['!ref'] = XLSX.utils.encode_range({ s: start, e: end })
  workbook.Sheets[name] = shifted
}

function semanticProjection(values: ReturnType<typeof parseOther>['values'], sheet: string) {
  return values.filter(value => value.source.sheet === sheet).map(value => ({
    key: value.key, table: value.table, code: value.code, label: value.label, context: value.context,
    unit: value.unit, value: value.value, valueKind: value.valueKind, effectiveFrom: value.effectiveFrom,
    indexation: value.indexation?.value,
  })).sort((a, b) => a.key.localeCompare(b.key))
}

describe('autonomous reader v3: additional source tables', () => {
  it('maps the five supported sheets with explicit provenance and units', () => {
    const result = parseOther(reference())
    expect(result.coverage.map(table => [table.sheet, table.mappedCells])).toEqual([
      ['W ', 50],
      ['AndereBedrWLH_AutresMontCHOM', 63],
      ['Activering_Activation', 14],
      ['AndereUitk_AutresAlloc', 17],
      ['Bonus', 28],
    ])
    expect(result.issues.filter(issue => issue.blocking)).toEqual([])
    expect(result.values.find(value => value.source.sheet === 'W ' && value.source.cell === 'P9')).toMatchObject({
      code: 'WA2V+WA7V', table: 'insertion_assimilees_full', unit: 'EUR/day', effectiveFrom: '2026-09-01',
    })
    expect(result.values.find(value => value.source.sheet === 'W ' && value.source.cell === 'R9')?.unit).toBe('EUR/day')
    expect(result.values.find(value => value.source.sheet === 'Activering_Activation' && value.source.cell === 'J10')).toMatchObject({
      valueKind: 'expression', unit: 'EUR/month', value: '500,00 X U/[Sx4] (max. 500,00)',
    })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'I12')).toMatchObject({
      code: 'coefficient', unit: 'ratio', value: '0.2699',
    })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'K12')).toMatchObject({
      code: 'offset', unit: 'EUR/month', value: '2300.62',
    })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'C11')).toMatchObject({
      code: 'salary_upper_lt', label: 'Seuil supérieur strict du salaire S',
    })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'C12')).toMatchObject({
      code: 'salary_lower_gt', label: 'Seuil inférieur strict du salaire S',
    })
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'C11')?.context).toContain('Condition source: S < seuil')
    expect(result.values.find(value => value.source.sheet === 'AndereBedrWLH_AutresMontCHOM' && value.source.cell === 'O29')?.source.formula).toContain("'W '!$P$21")
    expect(result.values.find(value => value.source.sheet === 'AndereBedrWLH_AutresMontCHOM' && value.source.cell === 'P17')?.indexation?.source.cell).toBe('P1')
    expect(result.values.find(value => value.source.sheet === 'AndereBedrWLH_AutresMontCHOM' && value.source.cell === 'O6')?.indexation).toBeUndefined()
    expect(result.values.find(value => value.source.sheet === 'Bonus' && value.source.cell === 'C11')?.indexation).toBeUndefined()
  })

  it('blocks missing, moved, error, and uncached formula source values', () => {
    const missing = reference()
    delete missing.Sheets.AndereUitk_AutresAlloc.D15
    expect(parseOther(missing).issues).toContainEqual(expect.objectContaining({ sheet: 'AndereUitk_AutresAlloc', code: 'missing_rate_value', blocking: true }))

    const moved = reference()
    delete moved.Sheets.Bonus.I12
    moved.Sheets.Bonus.U27 = { t: 'n', v: 2300.62 }
    expect(parseOther(moved).issues).toContainEqual(expect.objectContaining({ sheet: 'Bonus', cell: 'B12', code: 'missing_bonus_coefficient', blocking: true }))
    expect(parseOther(moved).issues).toContainEqual(expect.objectContaining({ sheet: 'Bonus', cell: 'U27', code: 'unmapped_sheet_value', blocking: true }))

    const error = reference()
    error.Sheets.Bonus.C11 = { t: 'e', v: 7 }
    expect(parseOther(error).issues).toContainEqual(expect.objectContaining({ sheet: 'Bonus', cell: 'C11', code: 'unknown_rate_value', blocking: true }))

    const uncached = reference()
    uncached.Sheets.Bonus.C11.v = null
    expect(parseOther(uncached).issues).toContainEqual(expect.objectContaining({ sheet: 'Bonus', cell: 'C11', code: 'formula_without_cached_result', blocking: true }))
  })

  it('blocks semantic collisions and detects a missing code identity with still-present values', () => {
    const collision = reference()
    collision.Sheets['W '].M10 = { t: 's', v: 'WA2V WA7V' }
    const collisionResult = parseOther(collision)
    expect(collisionResult.issues).toContainEqual(expect.objectContaining({ sheet: 'W ', code: 'duplicate_semantic_identity', blocking: true }))

    const absent = reference()
    delete absent.Sheets['W '].M9
    expect(parseOther(absent).issues).toContainEqual(expect.objectContaining({ sheet: 'W ', cell: 'M9', code: 'unknown_rate_identity', blocking: true }))
  })

  it('keeps semantic identities through whole-grid shifts and internal blank row/column insertions', () => {
    const sheets = ['W ', 'AndereBedrWLH_AutresMontCHOM', 'Activering_Activation', 'Bonus']
    for (const sheet of sheets) {
      const original = reference()
      const expected = parseOther(original)
      expect(expected.issues.filter(issue => issue.sheet === sheet && issue.blocking)).toEqual([])
      const moved = reference()
      shiftGrid(moved, sheet)
      const actual = parseOther(moved)
      expect(actual.issues.filter(issue => issue.sheet === sheet && issue.blocking)).toEqual([])
      expect(semanticProjection(actual.values, sheet)).toEqual(semanticProjection(expected.values, sheet))
    }
  })

  it('rejects an unknown activation amount expression instead of claiming it as metadata', () => {
    const workbook = reference()
    workbook.Sheets.Activering_Activation.J10 = { t: 's', v: 'future calculation format' }
    expect(parseOther(workbook).issues).toContainEqual(expect.objectContaining({
      sheet: 'Activering_Activation', cell: 'J10', code: 'missing_activation_value', blocking: true,
    }))
  })

  it('requires each supported article/label/unit identity and each activation expression', () => {
    const missingArticle = reference()
    delete missingArticle.Sheets.AndereBedrWLH_AutresMontCHOM.O6
    expect(parseOther(missingArticle).issues.some(issue => issue.sheet === 'AndereBedrWLH_AutresMontCHOM' && issue.code === 'missing_supported_rate_identity' && issue.blocking)).toBe(true)

    const missingActivation = reference()
    delete missingActivation.Sheets.Activering_Activation.J10
    expect(parseOther(missingActivation).issues).toContainEqual(expect.objectContaining({
      sheet: 'Activering_Activation', cell: 'J10', code: 'missing_activation_value', blocking: true,
    }))
  })
})
