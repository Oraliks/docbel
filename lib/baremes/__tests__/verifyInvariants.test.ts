import { describe, it, expect } from 'vitest'
import { verifyInvariants } from '../verifyInvariants'
import type { BaremeAmountDraft, BaremeCategory } from '../types'

function a(category: BaremeCategory, code: string, tranche: string, amount: number): BaremeAmountDraft {
  return {
    sourceSheet: category,
    category,
    allocationCode: code,
    salaryCode: tranche,
    amount,
    unit: 'daily',
    validFrom: null,
    comparisonKey: `${category}:${code}:${tranche}`,
    status: 'valid',
    warnings: [],
  } as BaremeAmountDraft
}

// Jeu minimal conforme (valeurs réelles du barème 01/03/2026).
function conforming(): BaremeAmountDraft[] {
  return [
    a('full_unemployment', 'AA1', 'MIN', 76.55),
    a('full_unemployment', 'AA2', 'MIN', 76.55),
    a('full_unemployment', 'AA3', 'MIN', 69.59),
    a('full_unemployment', 'NA1', 'MIN', 62.05),
    a('full_unemployment', 'BA1', 'MIN', 59.72),
    a('full_unemployment', 'BA3', 'MIN', 50.11),
    a('full_unemployment', 'BX', 'MIN', 41.54),
    a('full_unemployment', 'BB', 'MIN', 29.27),
    a('half_unemployment', 'AA1', 'MIN', 38.28),
    a('half_unemployment', 'BX', 'MIN', 20.77),
  ]
}

describe('verifyInvariants', () => {
  it('0 violation sur un jeu conforme', () => {
    const r = verifyInvariants(conforming())
    expect(r.alerts).toHaveLength(0)
    expect(r.sentinelsChecked).toBeGreaterThan(0)
  })

  it('sentinelle : détecte un swap de colonnes (AA1 prend la valeur de BA1)', () => {
    const amounts = conforming()
    amounts.find((x) => x.allocationCode === 'AA1' && x.category === 'full_unemployment')!.amount = 59.72
    const r = verifyInvariants(amounts)
    expect(r.alerts.some((x) => x.level === 'error' && /sentinelle/i.test(x.title ?? ''))).toBe(true)
  })

  it('ordre : détecte AA1 < BA1 à une tranche (familles inversées)', () => {
    const amounts = [
      a('full_unemployment', 'AA1', '50', 50),
      a('full_unemployment', 'NA1', '50', 60),
      a('full_unemployment', 'BA1', '50', 70),
    ]
    const r = verifyInvariants(amounts)
    expect(r.orderingViolations).toBeGreaterThan(0)
    expect(r.alerts.some((x) => x.level === 'error' && /Ordre de montants/i.test(x.title ?? ''))).toBe(true)
  })

  it('ratio : détecte une demi-allocation ≠ plein/2', () => {
    const amounts = [
      a('full_unemployment', 'AA1', 'MIN', 76.55),
      a('half_unemployment', 'AA1', 'MIN', 76.55), // devrait être 38.28
    ]
    const r = verifyInvariants(amounts)
    expect(r.ratioViolations).toBeGreaterThan(0)
  })

  it('monotonie : détecte un montant décroissant entre tranches', () => {
    const amounts = [
      a('full_unemployment', 'AA1', '10', 80),
      a('full_unemployment', 'AA1', '11', 60), // décroît
    ]
    const r = verifyInvariants(amounts)
    expect(r.monotonyViolations).toBeGreaterThan(0)
  })

  it('plausibilité : détecte un montant absurde', () => {
    const amounts = [a('full_unemployment', 'AA1', '50', 9999)]
    const r = verifyInvariants(amounts)
    expect(r.plausibilityViolations).toBeGreaterThan(0)
  })
})
