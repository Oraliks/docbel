import { describe, expect, it } from 'vitest'
import { categoryHasCodeMapping, isKnownCode, resolveCodeInfo } from '../code-mapping'
import { isIgnoredCode } from '../ignored-codes'

describe('code-mapping — résolution des codes ONEM', () => {
  it('reconnaît les codes du chômage complet avec leur sémantique', () => {
    const info = resolveCodeInfo('AA1', 'full_unemployment')
    expect(info).not.toBeNull()
    expect(info?.situation).toBe('A')
    expect(info?.situationLabelFr).toBe('Chef de ménage')
    expect(info?.period).toBe(1)
    expect(info?.phase).toBe(1)
    expect(info?.rate).toBe(0.65)
  })

  it('reconnaît les codes présents dans le glossaire même marqués TODO', () => {
    // AFoud est dans le glossaire (sémantique à confirmer) → connu, pas une issue
    expect(isKnownCode('AFoud', 'full_unemployment')).toBe(true)
    expect(isKnownCode('AFoud', 'half_unemployment')).toBe(true)
  })

  it('retourne null pour un code absent du glossaire', () => {
    expect(resolveCodeInfo('ZZ9', 'full_unemployment')).toBeNull()
    expect(isKnownCode('ZZ9', 'full_unemployment')).toBe(false)
  })

  it('résout les codes SpecCat et chômage temporaire via leurs sections', () => {
    expect(isKnownCode('A6', 'special_category_full')).toBe(true)
    expect(isKnownCode('A0H', 'temporary_unemployment_full')).toBe(true)
  })

  it('résout les codes W composés par préfixe (variantes)', () => {
    expect(isKnownCode('W', 'allocation_w')).toBe(true)
    expect(isKnownCode('WA2V', 'allocation_w')).toBe(true)
  })

  it("sait quelles catégories n'attendent pas de codes d'allocation", () => {
    expect(categoryHasCodeMapping('full_unemployment')).toBe(true)
    expect(categoryHasCodeMapping('salary_bracket')).toBe(false)
    expect(categoryHasCodeMapping('basic_amount')).toBe(false)
  })
})

describe('ignored-codes — ignores explicites', () => {
  it('ignore les taux d\'en-tête avec une raison', () => {
    const entry = isIgnoredCode('0.65')
    expect(entry).not.toBeNull()
    expect(entry?.reason).toContain('65')
  })

  it('ne touche pas aux vrais codes', () => {
    expect(isIgnoredCode('AA1')).toBeNull()
  })
})
