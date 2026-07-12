import { describe, it, expect } from 'vitest'
import {
  validateAiBlocks,
  generateSlug,
  BlockSchema,
  BlocksSchema,
  CreatePageSchema,
  UpdatePageSchema,
} from '../validation'
import { BLOCK_SCHEMAS } from '../schema-registry'

// Un heading valide minimal (le type `heading` existe dans le registry).
const validHeading = {
  id: 'h1',
  type: 'heading',
  props: { text: 'Bonjour', level: 2 },
}

describe('validateAiBlocks — validation stricte des sorties IA', () => {
  it('accepte un bloc connu bien formé', () => {
    const out = validateAiBlocks([validHeading])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('heading')
  })

  it('écarte un bloc de type inconnu (pas de fallback permissif)', () => {
    const out = validateAiBlocks([
      { id: 'x', type: 'ceci-nexiste-pas', props: { foo: 'bar' } },
    ])
    expect(out).toHaveLength(0)
  })

  it('écarte un bloc malformé sans faire échouer ses voisins valides', () => {
    const out = validateAiBlocks([
      validHeading,
      { id: 'bad', type: 'heading', props: { level: 999 } }, // level hors bornes / text manquant
    ])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('h1')
  })

  it('renvoie [] pour une entrée non-tableau', () => {
    expect(validateAiBlocks(null)).toEqual([])
    expect(validateAiBlocks({})).toEqual([])
    expect(validateAiBlocks('nope')).toEqual([])
  })

  it('applique la whitelist allowedTypes AVANT la validation de forme', () => {
    const out = validateAiBlocks([validHeading], ['text']) // heading non autorisé
    expect(out).toHaveLength(0)
    const out2 = validateAiBlocks([validHeading], ['heading'])
    expect(out2).toHaveLength(1)
  })
})

describe('BlockSchema / BlocksSchema — chargement legacy', () => {
  it('valide un bloc connu via la variante stricte', () => {
    expect(BlockSchema.safeParse(validHeading).success).toBe(true)
  })

  it('tolère un type inconnu via le fallback permissif (legacy)', () => {
    const legacy = { id: 'l1', type: 'ancienBloc', props: { whatever: 1 } }
    expect(BlockSchema.safeParse(legacy).success).toBe(true)
  })

  it('refuse un tableau de plus de 500 blocs', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({
      ...validHeading,
      id: `h${i}`,
    }))
    expect(BlocksSchema.safeParse(many).success).toBe(false)
  })

  it('refuse un bloc sans id', () => {
    expect(BlockSchema.safeParse({ type: 'heading', props: { text: 'x', level: 2 } }).success).toBe(
      false
    )
  })
})

describe('Invariant du registry — chaque schéma de bloc est un schéma Zod', () => {
  it('expose 100+ types de blocs', () => {
    // Garde-fou : le registry ne doit pas s'effondrer silencieusement.
    expect(Object.keys(BLOCK_SCHEMAS).length).toBeGreaterThan(100)
  })

  it('chaque schéma expose une méthode safeParse', () => {
    for (const [type, schema] of Object.entries(BLOCK_SCHEMAS)) {
      expect(typeof schema.safeParse, `schéma manquant pour ${type}`).toBe('function')
    }
  })
})

describe('generateSlug', () => {
  it('translittère les accents et met en kebab-case', () => {
    expect(generateSlug('Allocations d’Insertion')).toBe('allocations-dinsertion')
    expect(generateSlug('Chômage & CPAS')).toBe('chomage-cpas')
    expect(generateSlug('  Espaces   multiples  ')).toBe('espaces-multiples')
  })

  it('remplace les underscores par des tirets et fusionne les tirets', () => {
    expect(generateSlug('a_b__c')).toBe('a-b-c')
    expect(generateSlug('--déjà--slug--')).toBe('deja-slug')
  })

  it('renvoie "page" pour un titre vide de contenu utile', () => {
    expect(generateSlug('!!!')).toBe('page')
    expect(generateSlug('   ')).toBe('page')
  })

  it('tronque à 80 caractères', () => {
    const long = 'mot '.repeat(50)
    expect(generateSlug(long).length).toBeLessThanOrEqual(80)
  })
})

describe('CreatePageSchema / UpdatePageSchema', () => {
  it('accepte une création minimale (titre seul)', () => {
    expect(CreatePageSchema.safeParse({ title: 'Ma page' }).success).toBe(true)
  })

  it('refuse un slug avec majuscules ou espaces', () => {
    expect(CreatePageSchema.safeParse({ title: 'X', slug: 'Mon Slug' }).success).toBe(false)
  })

  it('accepte un slug vide (généré côté serveur)', () => {
    expect(CreatePageSchema.safeParse({ title: 'X', slug: '' }).success).toBe(true)
  })

  it('n’accepte que les statuts draft/published/scheduled', () => {
    expect(UpdatePageSchema.safeParse({ status: 'published' }).success).toBe(true)
    expect(UpdatePageSchema.safeParse({ status: 'archivé' }).success).toBe(false)
  })

  it('normalise metaTitle vide en null', () => {
    const r = UpdatePageSchema.safeParse({ metaTitle: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.metaTitle).toBeNull()
  })

  it('refuse une clé de variable invalide', () => {
    const bad = UpdatePageSchema.safeParse({ variables: [{ key: '1-bad', value: 'x' }] })
    expect(bad.success).toBe(false)
    const ok = UpdatePageSchema.safeParse({ variables: [{ key: 'monMontant', value: 'x' }] })
    expect(ok.success).toBe(true)
  })
})
