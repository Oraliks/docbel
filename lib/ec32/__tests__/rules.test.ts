// =====================================================================
//  eC3.2 — Tests des règles & de la logique du simulateur
// ---------------------------------------------------------------------
//  Environnement node (cf. vitest.config.ts). Couvre la génération de la
//  grille calendrier, l'autorisation d'envoi, le libellé de date d'envoi
//  et l'intégrité des préréglages / comportements de mois.
// =====================================================================

import { describe, it, expect } from 'vitest'

import {
  EC32_SITUATION_TYPES,
  type Ec32SituationType,
} from '../types'
import {
  EC32_MONTH_BEHAVIORS,
  EC32_SCENARIO_PRESETS,
  generateMonthGrid,
  getFirstSendDateLabel,
  getMonthBehavior,
  initialSimulatedDay,
  isSendAllowed,
  lastDayOfMonth,
} from '../rules'

const SCENARIO_KEYS = [
  'all-month',
  'work-own',
  'work-elsewhere-usual',
  'work-elsewhere-weekend',
  'other-regular',
  'sick',
  'vacation',
  'other-situation',
  'multiple-employers',
  'no-payment-org',
  'correction',
  'construction-cp124',
  'first-effective-day',
  'wrong-month',
] as const

describe('generateMonthGrid', () => {
  const behaviorMay = EC32_MONTH_BEHAVIORS['2025-05']!
  const gridMay = generateMonthGrid(behaviorMay)

  it('contient 31 jours dans le mois pour mai 2025', () => {
    const inMonth = gridMay.filter((cell) => cell.inMonth)
    expect(inMonth).toHaveLength(31)
  })

  it('produit des semaines complètes (multiple de 7)', () => {
    expect(gridMay.length % 7).toBe(0)
  })

  it('attribue le bon jour de semaine au 1er mai 2025 (jeudi → weekday 4)', () => {
    const firstOfMonth = gridMay.find(
      (cell) => cell.inMonth && cell.day === 1,
    )
    expect(firstOfMonth?.weekday).toBe(4)
  })

  it('marque isFirstEffectiveDay uniquement au jour 5', () => {
    const flagged = gridMay.filter((cell) => cell.isFirstEffectiveDay)
    expect(flagged).toHaveLength(1)
    expect(flagged[0]?.day).toBe(5)
    expect(flagged[0]?.inMonth).toBe(true)
  })

  it('rend les jours du mois sélectionnables (par défaut chômage)', () => {
    const inMonth = gridMay.filter((cell) => cell.inMonth)
    expect(inMonth.every((cell) => cell.selectable)).toBe(true)
    expect(
      inMonth.every((cell) => cell.situation === 'temporary_unemployment'),
    ).toBe(true)
  })

  it('grise les jours hors mois en not_applicable et non sélectionnables', () => {
    const outside = gridMay.filter((cell) => !cell.inMonth)
    expect(outside.length).toBeGreaterThan(0)
    expect(outside.every((cell) => !cell.selectable)).toBe(true)
    expect(
      outside.every((cell) => cell.situation === 'not_applicable'),
    ).toBe(true)
  })

  it('produit des dates ISO yyyy-mm-dd et correction null', () => {
    for (const cell of gridMay) {
      expect(cell.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(cell.correction).toBeNull()
    }
  })

  it('respecte contractStartDay / contractEndDay quand définis', () => {
    const grid = generateMonthGrid({
      key: 'test',
      year: 2025,
      month: 5,
      status: 'draft',
      firstSendDay: 28,
      contractStartDay: 10,
      contractEndDay: 20,
    })
    const inMonth = grid.filter((cell) => cell.inMonth)
    const day5 = inMonth.find((cell) => cell.day === 5)
    const day15 = inMonth.find((cell) => cell.day === 15)
    const day25 = inMonth.find((cell) => cell.day === 25)
    expect(day5?.selectable).toBe(false)
    expect(day5?.situation).toBe('not_applicable')
    expect(day15?.selectable).toBe(true)
    expect(day15?.situation).toBe('temporary_unemployment')
    expect(day25?.selectable).toBe(false)
  })
})

describe('lastDayOfMonth', () => {
  it('renvoie 31 pour mai et 30 pour avril 2025', () => {
    expect(lastDayOfMonth(2025, 5)).toBe(31)
    expect(lastDayOfMonth(2025, 4)).toBe(30)
  })
})

describe('isSendAllowed', () => {
  const behaviorMay = EC32_MONTH_BEHAVIORS['2025-05']!
  const behaviorSent = EC32_MONTH_BEHAVIORS['2025-03']!

  it('est faux si simulatedDay < firstSendDay', () => {
    expect(isSendAllowed(behaviorMay, behaviorMay.firstSendDay - 1)).toBe(false)
  })

  it('est vrai si simulatedDay >= firstSendDay', () => {
    expect(isSendAllowed(behaviorMay, behaviorMay.firstSendDay)).toBe(true)
    expect(isSendAllowed(behaviorMay, behaviorMay.firstSendDay + 2)).toBe(true)
  })

  it('est toujours faux pour une carte envoyée (status sent)', () => {
    expect(isSendAllowed(behaviorSent, 31)).toBe(false)
  })
})

describe('initialSimulatedDay', () => {
  it('place le mois en cours avant la date d’envoi (envoi bloqué)', () => {
    const may = EC32_MONTH_BEHAVIORS['2025-05']!
    const day = initialSimulatedDay(may)
    expect(day).toBeLessThan(may.firstSendDay)
    expect(isSendAllowed(may, day)).toBe(false)
  })

  it('place le mois passé non envoyé en fin de mois (envoi possible)', () => {
    const april = EC32_MONTH_BEHAVIORS['2025-04']!
    const day = initialSimulatedDay(april)
    expect(day).toBe(lastDayOfMonth(april.year, april.month))
    expect(isSendAllowed(april, day)).toBe(true)
  })

  it('place le mois suivant au jour 1 (envoi pas encore possible)', () => {
    const june = EC32_MONTH_BEHAVIORS['2025-06']!
    expect(initialSimulatedDay(june)).toBe(1)
    expect(isSendAllowed(june, initialSimulatedDay(june))).toBe(false)
  })

  it('place le mois envoyé en fin de mois mais sans envoi autorisé', () => {
    const march = EC32_MONTH_BEHAVIORS['2025-03']!
    const day = initialSimulatedDay(march)
    expect(day).toBe(lastDayOfMonth(march.year, march.month))
    expect(isSendAllowed(march, day)).toBe(false)
  })
})

describe('getFirstSendDateLabel', () => {
  it('contient le jour 28 et « mai » pour mai 2025', () => {
    const label = getFirstSendDateLabel(
      EC32_MONTH_BEHAVIORS['2025-05']!,
      'Mai 2025',
    )
    expect(label).toContain('28')
    expect(label).toContain('mai')
    expect(label).toContain('2025')
  })
})

describe('getMonthBehavior', () => {
  it('retrouve un mois connu et renvoie undefined sinon', () => {
    expect(getMonthBehavior('2025-05')?.month).toBe(5)
    expect(getMonthBehavior('1999-01')).toBeUndefined()
  })
})

describe('EC32_MONTH_BEHAVIORS', () => {
  it('possède exactement les 4 clés attendues', () => {
    expect(Object.keys(EC32_MONTH_BEHAVIORS).sort()).toEqual(
      ['2025-03', '2025-04', '2025-05', '2025-06'].sort(),
    )
  })

  it('chaque behavior est cohérent avec sa clé', () => {
    for (const [key, behavior] of Object.entries(EC32_MONTH_BEHAVIORS)) {
      expect(behavior.key).toBe(key)
      const [year, month] = key.split('-').map(Number)
      expect(behavior.year).toBe(year)
      expect(behavior.month).toBe(month)
    }
  })
})

describe('EC32_SCENARIO_PRESETS', () => {
  it('possède les 14 clés de scénario', () => {
    expect(Object.keys(EC32_SCENARIO_PRESETS)).toHaveLength(14)
    for (const key of SCENARIO_KEYS) {
      expect(EC32_SCENARIO_PRESETS[key]).toBeDefined()
    }
  })

  it('chaque suggestedSituation défini est une situation valide', () => {
    const allowed = new Set<Ec32SituationType>(EC32_SITUATION_TYPES)
    for (const preset of Object.values(EC32_SCENARIO_PRESETS)) {
      if (preset.suggestedSituation !== undefined) {
        expect(allowed.has(preset.suggestedSituation)).toBe(true)
      }
    }
  })

  it('chaque monthKey référencé (si défini) existe dans les behaviors', () => {
    for (const preset of Object.values(EC32_SCENARIO_PRESETS)) {
      if (preset.monthKey !== undefined) {
        expect(EC32_MONTH_BEHAVIORS[preset.monthKey]).toBeDefined()
      }
    }
  })
})
