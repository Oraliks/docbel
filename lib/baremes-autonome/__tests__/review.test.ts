import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { describe, it, expect } from 'vitest'
import { readWorkbookFromParsedWorkbook as read } from '../readers/v4'
import { compareReadings } from '../compare'
import { analyzeReview, brusselsToday, reviewTechnicalIssues, unusual, variation } from '../review-policy'
import type { Difference } from '../types'
import { readWorkbookVersion } from '../read-workbook'
const book = () =>
  XLSX.read(readFileSync('lib/baremes-autonome/__tests__/fixtures/barema20260901-new.xlsx'), {
    type: 'buffer',
    cellFormula: true,
  })
const token = {
  candidateId: 'c',
  candidateRevision: 'c'.repeat(64),
  referenceId: 'r',
  referenceRevision: 'r'.repeat(64),
  generation: 1,
}
const base = read(book())
function pair(a: string, b: string): Difference {
  const value = base.values.find((value) => value.unit === 'EUR/day')!
  return {
    key: value.key,
    kind: 'modified',
    before: { ...value, value: a },
    after: { ...value, value: b },
    contextChanged: false,
  }
}
describe('persistent review policy and proved source scope', () => {
  it('does not invent reviews when upgrading the frozen v1/v2/v3 readings of the same file', () => {
    for (const version of [1, 2, 3]) {
      const before = readWorkbookVersion(
        readFileSync('lib/baremes-autonome/__tests__/fixtures/barema20260901-new.xlsx'),
        version,
      )
      expect(
        analyzeReview(before, base, compareReadings(before, base), token, [], false, false).pending,
      ).toBe(0)
    }
  })
  it.each([
    ['100', '119.999999999999999999999999', false],
    ['100', '120', true],
    ['100', '80', true],
    ['0', '1', true],
    ['1', '0', true],
    ['0', '0', false],
    ['-100', '-80', true],
  ])('compares %s → %s exactly', (a, b, result) => expect(unusual(pair(a, b))).toBe(result))
  it('keeps tiny exact deltas and never invents infinite percentages', () => {
    expect(variation('0', '0.00000000000000000001')).toEqual({
      delta: '0.00000000000000000001',
      percent: null,
    })
    expect(variation('100', '120').percent).toBe('20')
  })
  it('uses the Brussels day at midnight and summer time', () => {
    expect(brusselsToday(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25')
    expect(brusselsToday(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30')
  })
  it('does not turn first import into thousands of decisions', () => {
    expect(
      analyzeReview(
        null,
        base,
        compareReadings(null, base),
        { ...token, referenceId: null, referenceRevision: null },
        [],
        false,
        false,
      ).tasks,
    ).toEqual([])
  })
  it.each(['row', 'section', 'sheet'])('allows review of an actual removed activation %s', (scope) => {
    const wb = book(),
      sheet = wb.Sheets.Activering_Activation
    if (scope === 'row') {
      delete sheet.I10
      delete sheet.J10
    }
    if (scope === 'section')
      for (const cell of Object.keys(sheet))
        if (
          !cell.startsWith('!') &&
          ['I', 'J'].includes(cell.replace(/\d/g, '')) &&
          Number(cell.replace(/\D/g, '')) >= 7 &&
          Number(cell.replace(/\D/g, '')) <= 15
        )
          delete sheet[cell]
    if (scope === 'sheet') {
      delete wb.Sheets.Activering_Activation
      wb.SheetNames = wb.SheetNames.filter((name) => name !== 'Activering_Activation')
    }
    const after = read(wb),
      rows = compareReadings(base, after)
    expect(after.issues.filter((issue) => issue.blocking)).toEqual([])
    const review = analyzeReview(base, after, rows, token, [], false, false)
    expect(review.tasks.filter((task) => task.kind === 'removal')).toHaveLength(1)
    expect(review.availability).toBe('review')
    const task = review.tasks[0]
    expect(task.memberKeys.length).toBe(rows.filter((row) => row.kind === 'absent').length)
    expect(task.admissible).toBe(true)
  })
  it('blocks a declared sheet whose content could not be parsed', () => {
    const wb = book()
    delete wb.Sheets.Activering_Activation
    const after = read(wb)
    expect(after.scope?.find((scope) => scope.sheet === 'Activering_Activation')?.state).toBe('unreadable')
    expect(after.issues.some((issue) => issue.sheet === 'Activering_Activation' && issue.blocking)).toBe(true)
  })
  it('never accepts a blank amount whose identity remains present', () => {
    const wb = book()
    delete wb.Sheets.Activering_Activation.J10
    expect(read(wb).issues.some((issue) => issue.blocking)).toBe(true)
  })
  it('distinguishes a missing recognized frequency column from a blank present amount', () => {
    const value = base.values.find(
        (value) => value.source.sheet === 'AndereBedrWLH_AutresMontCHOM' && value.unit === 'EUR/hour',
      )!,
      wb = book(),
      cell = value.source.cell,
      column = XLSX.utils.decode_cell(cell).c
    delete wb.Sheets[value.source.sheet][cell]
    expect(read(wb).issues.some((issue) => issue.blocking && issue.code === 'missing_rate_value')).toBe(true)
    const clean = book(),
      sheet = clean.Sheets[value.source.sheet]
    for (const address of Object.keys(sheet))
      if (!address.startsWith('!') && XLSX.utils.decode_cell(address).c === column) delete sheet[address]
    const after = read(clean)
    expect(after.issues.filter((issue) => issue.blocking)).toEqual([])
    expect(
      compareReadings(base, after)
        .filter((row) => row.kind === 'absent')
        .every((row) => row.before!.unit === 'EUR/hour'),
    ).toBe(true)
  })
  it('groups a comparable common variation exhaustively without accepting it', () => {
    const wb = book()
    for (const cell of ['C12', 'C13'])
      wb.Sheets.A_N_B_vol_plein[cell] = {
        ...wb.Sheets.A_N_B_vol_plein[cell],
        v: Number(wb.Sheets.A_N_B_vol_plein[cell].v) * 2,
      }
    const after = read(wb),
      rows = compareReadings(base, after),
      review = analyzeReview(base, after, rows, token, [], false, false)
    expect(review.tasks).toHaveLength(1)
    expect(review.tasks[0].memberCount).toBe(2)
    expect(review.pending).toBe(1)
  })
  it('allows future preparation but activates only on the Brussels effective day', () => {
    const rows = compareReadings(null, base),
      snapshot = { ...token, referenceId: null, referenceRevision: null }
    expect(
      analyzeReview(null, base, rows, snapshot, [], false, false, new Date('2026-08-31T21:59:59Z'))
        .availability,
    ).toBe('future')
    expect(
      analyzeReview(null, base, rows, snapshot, [], false, false, new Date('2026-08-31T22:00:00Z'))
        .availability,
    ).toBe('ready')
  })
  it('blocks negative money and incompatible units', () => {
    expect(reviewTechnicalIssues([pair('10', '-1')], base)[0].code).toBe('NEGATIVE_MONETARY_VALUE')
    const row = pair('10', '12')
    row.after!.unit = 'EUR/month'
    expect(reviewTechnicalIssues([row], base)[0].code).toBe('INCOMPATIBLE_VALUE_CONTEXT')
  })
  it('reviews changed business context and text expressions without numeric deltas', () => {
    const row = pair('100', '100')
    row.contextChanged = true
    row.after!.context = ['Population source modifiée']
    expect(analyzeReview(base, base, [row], token, [], false, false).tasks[0].kind).toBe('context')
    row.before!.valueKind = 'expression'
    row.after!.valueKind = 'expression'
    row.before!.value = '10 X S'
    row.after!.value = '20 X S'
    expect(unusual(row)).toBe(false)
    expect(analyzeReview(base, base, [row], token, [], false, false).tasks[0].kind).toBe('context')
  })
  it('keeps formula-only changes reviewable and decisions bound to exact data', () => {
    const wb = book()
    wb.Sheets.A_N_B_vol_plein.C12.f += ' + 0'
    const after = read(wb),
      rows = compareReadings(base, after),
      review = analyzeReview(base, after, rows, token, [], false, false)
    expect(review.tasks).toHaveLength(1)
    expect(review.tasks[0].kind).toBe('context')
    const decision = {
      id: 'd',
      taskId: review.tasks[0].id,
      kind: 'context',
      status: 'accepted',
      reason: 'Source verified',
      actorId: 'actor',
      createdAt: new Date().toISOString(),
      officialSource: null,
      effectiveDate: null,
      fingerprint: review.fingerprint,
    }
    expect(analyzeReview(base, after, rows, token, [decision], false, false).pending).toBe(0)
    expect(
      analyzeReview(base, after, rows, { ...token, generation: 2 }, [decision], false, false).pending,
    ).toBe(1)
  })
})
