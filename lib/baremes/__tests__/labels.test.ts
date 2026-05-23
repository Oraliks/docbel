import { describe, it, expect } from 'vitest'
import { resolveLabelFr } from '../labels'

describe('resolveLabelFr', () => {
  it('renvoie le label existant si déjà présent', () => {
    const result = resolveLabelFr({
      comparisonKey: 'basic_amount:D7',
      article: 'art. 28',
      category: 'basic_amount',
      existingLabelFr: 'Mon label existant',
    })
    expect(result).toBe('Mon label existant')
  })

  it('priorité 1 : résout via byKey (comparisonKey exact)', () => {
    const result = resolveLabelFr({
      comparisonKey: 'basic_amount:D7',
      article: null,
      category: 'basic_amount',
      existingLabelFr: null,
    })
    expect(result).toContain('GMMI')
  })

  it('priorité 2 : fallback sur byArticle', () => {
    const result = resolveLabelFr({
      comparisonKey: 'inconnu:XYZ',
      article: '28, § 2 (5 MB)',
      category: 'basic_amount',
      existingLabelFr: null,
    })
    expect(result).toContain('GMMI')
  })

  it('priorité 3 : fallback sur byCategory', () => {
    const result = resolveLabelFr({
      comparisonKey: 'inconnu:XYZ',
      article: null,
      category: 'salary_bracket',
      existingLabelFr: null,
    })
    expect(result).toContain('Tranche salariale')
  })

  it('renvoie null si aucun mapping trouvé', () => {
    const result = resolveLabelFr({
      comparisonKey: 'totalement_inconnu',
      article: 'article_inconnu',
      category: 'categorie_inconnue',
      existingLabelFr: null,
    })
    expect(result).toBeNull()
  })
})
