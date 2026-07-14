import { describe, it, expect } from 'vitest'
import { classifyQuery, type SearchIntent } from '../search-classifier'
const cases: [string, SearchIntent][] = [
  ['', 'empty'],
  ['   ', 'empty'],
  ['1030', 'postal_code'],
  ['1000', 'postal_code'],
  ['Rue de la Loi 16, Bruxelles', 'address'],
  ['avenue Louise 143', 'address'],
  ['Chaussée de Charleroi 60, 1060', 'address'],
  ['Grote Markt 1, Antwerpen', 'address'],
  ['Schaerbeek', 'text'],
  ['ONEM', 'text'],
  ['CPAS de Liège', 'text'],
  ['bureau de pension', 'text'],
]
describe('classifyQuery', () => {
  it.each(cases)('classifie %j → %s', (input, expected) => {
    expect(classifyQuery(input)).toBe(expected)
  })
  it('un code postal seul n’est jamais une adresse', () => {
    expect(classifyQuery('1030')).toBe('postal_code')
  })
})
