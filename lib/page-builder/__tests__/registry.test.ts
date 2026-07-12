import { describe, it, expect } from 'vitest'
import { REGISTRY, getBlockDef, BLOCK_REGISTRY, BLOCKS_BY_CATEGORY } from '../registry'

// Ce test importe le REGISTRY complet (composants React inclus) — plus lourd que
// les tests de schémas purs, mais il vérifie l'invariant le plus important du
// page-builder : chaque bloc doit pouvoir se rendre avec ses valeurs par défaut.

describe('Invariant du registry — defaults ⊨ schema', () => {
  const entries = Object.entries(REGISTRY)

  it('agrège plus de 100 blocs', () => {
    expect(entries.length).toBeGreaterThan(100)
  })

  it('les defaults de CHAQUE bloc valident son propre schéma Zod', () => {
    const failures: string[] = []
    for (const [type, def] of entries) {
      const res = def.schema.safeParse(def.defaults)
      if (!res.success) {
        failures.push(`${type}: ${res.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ')}`)
      }
    }
    expect(failures, `blocs dont les defaults ne valident pas leur schéma:\n${failures.join('\n')}`).toEqual([])
  })

  it('chaque def porte un type, une meta cohérente et des composants', () => {
    for (const [type, def] of entries) {
      expect(def.type, `type manquant`).toBe(type)
      expect(typeof def.meta.name, `${type}: meta.name`).toBe('string')
      expect(def.meta.name.length, `${type}: meta.name vide`).toBeGreaterThan(0)
      expect(typeof def.Render, `${type}: Render`).toBe('function')
      expect(typeof def.Fields, `${type}: Fields`).toBe('function')
    }
  })
})

describe('Couche de compat BLOCK_REGISTRY', () => {
  it('getBlockDef renvoie une def pour un type connu, undefined sinon', () => {
    expect(getBlockDef('heading')).toBeDefined()
    expect(getBlockDef('type-inexistant')).toBeUndefined()
  })

  it('BLOCK_REGISTRY couvre exactement les mêmes types que REGISTRY', () => {
    expect(Object.keys(BLOCK_REGISTRY).sort()).toEqual(Object.keys(REGISTRY).sort())
  })

  it('BLOCKS_BY_CATEGORY range chaque bloc sous une catégorie connue', () => {
    const total = Object.values(BLOCKS_BY_CATEGORY).reduce((n, arr) => n + arr.length, 0)
    expect(total).toBe(Object.keys(BLOCK_REGISTRY).length)
  })
})
