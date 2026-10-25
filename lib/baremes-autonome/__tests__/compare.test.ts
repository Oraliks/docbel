import { describe, it, expect } from 'vitest'
import { compareReadings, digest } from '../compare'
import type { Reading, RateValue } from '../types'
const value: RateValue = { key: 'table/AA1/MIN', table: 'whole', code: 'AA1', label: 'source', context: ['whole', 'indexed'], unit: 'EUR/day', value: '78.09', source: { sheet: 's', cell: 'C12', raw: '78.09', formula: null } }
const reading = (values: RateValue[]): Reading => ({ values, sheets: ['whole'], effectiveFrom: '2026-09-01', issues: [], parserVersion: 1 })
describe('independent semantic comparison', () => {
  it('compares precise decimals and context, not coordinates', () => {
    expect(compareReadings(reading([value]), reading([{ ...value, source: { ...value.source, cell: 'D48' } }]))[0].kind).toBe('unchanged')
    expect(compareReadings(reading([value]), reading([{ ...value, value: '78.0901' }]))[0].kind).toBe('modified')
    expect(compareReadings(reading([value]), reading([{ ...value, unit: 'EUR/month' }]))[0].contextChanged).toBe(true)
    expect(compareReadings(reading([value]), reading([{ ...value, effectiveFrom: '2026-09-01' }]))[0].kind).toBe('unchanged')
    expect(compareReadings(reading([value]), reading([{ ...value, effectiveFrom: '2023-01-01' }]))[0].contextChanged).toBe(true)
  })
  it('preserves absence instead of substituting zero', () => {
    expect(compareReadings(reading([value]), reading([]))[0]).toMatchObject({ kind: 'absent', after: null })
    expect(compareReadings(null, reading([value]))[0].kind).toBe('added')
  })
  it('rejects collisions', () => {
    expect(() => compareReadings(null, reading([value, value]))).toThrow('AMBIGUOUS_IDENTITY')
  })
  it('hashes JSONB object key order consistently', () => {
    expect(digest({ a: 1, b: { c: 2, d: 3 } })).toBe(digest({ b: { d: 3, c: 2 }, a: 1 }))
  })
})
