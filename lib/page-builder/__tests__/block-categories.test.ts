import { describe, it, expect } from 'vitest'
import { BLOCK_CATEGORY_SOURCE, categoryOf } from '../block-categories'
import { BLOCK_SCHEMAS } from '../schema-registry'

describe('block-categories — map type → catégorie source (pure)', () => {
  it('couvre EXACTEMENT les mêmes types que le schema-registry', () => {
    const catTypes = Object.keys(BLOCK_CATEGORY_SOURCE).sort()
    const schemaTypes = Object.keys(BLOCK_SCHEMAS).sort()
    // Garde-fou anti-dérive : le rendu lazy public s'appuie là-dessus. Si un
    // bloc existe côté schéma sans catégorie, il ne se rendrait jamais en public.
    expect(catTypes).toEqual(schemaTypes)
  })

  it('categoryOf renvoie une catégorie pour un type connu, undefined sinon', () => {
    expect(categoryOf('heading')).toBeDefined()
    expect(categoryOf('ec32Page')).toBe('onem')
    expect(categoryOf('type-inexistant')).toBeUndefined()
  })

  it('mappe plus de 100 types', () => {
    expect(Object.keys(BLOCK_CATEGORY_SOURCE).length).toBeGreaterThan(100)
  })
})
