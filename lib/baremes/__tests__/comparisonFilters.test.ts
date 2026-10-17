import { describe, expect, it } from 'vitest'
import { comparisonFilterParams } from '../comparisonFilters'
describe('filtres communs au tableau et à l’export', () => {
  it('conserve feuille et catégorie même sans recherche ni état', () => {
    const params = comparisonFilterParams({ sheet: 'Feuille & annexes', category: 'basic' })
    expect(Object.fromEntries(params)).toEqual({ sheet: 'Feuille & annexes', category: 'basic' })
    expect(new URLSearchParams(params.toString()).get('sheet')).toBe('Feuille & annexes')
  })
  it('combine tous les filtres actifs sans pagination dans le CSV', () => {
    expect(Object.fromEntries(comparisonFilterParams({ state: 'modified', q: ' code ', sheet: 'F', category: 'C' }))).toEqual({ state: 'modified', q: 'code', sheet: 'F', category: 'C' })
    expect(comparisonFilterParams({ state: '', q: ' ' }).size).toBe(0)
  })
})
