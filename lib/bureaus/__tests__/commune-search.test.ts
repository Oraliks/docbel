import { describe, it, expect } from 'vitest'
import { normalizeForSearch, rankCommuneMatches, type CommuneLite } from '../commune-search'
const C = (insCode: string, nameFr: string, cp: string, nameNl?: string): CommuneLite => ({ insCode, nameFr, cp, nameNl })
describe('normalizeForSearch', () => {
  it('minuscule, sans accents, espaces normalisés', () => {
    expect(normalizeForSearch('  Liège  ')).toBe('liege')
    expect(normalizeForSearch('Sint-Job  in-t-Goor')).toBe('sint-job in-t-goor')
    expect(normalizeForSearch('DÉSÉLÉ')).toBe('desele')
  })
})
describe('rankCommuneMatches', () => {
  const list = [C('a','Schaerbeek','1030'), C('b','Charleroi','6000'), C('c','Liège','4000'), C('d','Anderlecht','1070')]
  it('matche par sous-chaîne, insensible aux accents', () => {
    expect(rankCommuneMatches('schaer', list).map((c) => c.insCode)).toEqual(['a'])
    expect(rankCommuneMatches('liege', list).map((c) => c.insCode)).toEqual(['c'])
  })
  it('préfixe avant milieu', () => {
    const l2 = [C('mid','Xander','1'), C('pre','Anderlecht','2')]
    expect(rankCommuneMatches('ander', l2).map((c) => c.insCode)).toEqual(['pre','mid'])
  })
  it('query vide → []', () => { expect(rankCommuneMatches('', list)).toEqual([]) })
  it('respecte limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => C(String(i), `Ville${i}a`, '1'))
    expect(rankCommuneMatches('ville', many, 5)).toHaveLength(5)
  })
  it('matche aussi le nom NL', () => {
    const l = [C('x','Bruxelles','1000','Brussel')]
    expect(rankCommuneMatches('brussel', l).map((c) => c.insCode)).toEqual(['x'])
  })
})
