import { describe, it, expect } from 'vitest'
import { verifySheetContracts, BAREME_CONTRACTS } from '../sheetContracts'
import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAmountDraft, BaremeCategory } from '../types'

function sheet(name: string, category = 'x'): ParsedSheet {
  return { name, category, sheetIndex: 0, rowCount: 1, colCount: 1, cellData: [['']], searchText: '' }
}

function amt(sourceSheet: string, category: BaremeCategory, code: string): BaremeAmountDraft {
  return {
    sourceSheet,
    category,
    allocationCode: code,
    amount: 1,
    unit: 'monthly',
    validFrom: null,
    comparisonKey: `${category}:${code}`,
    status: 'valid',
    warnings: [],
  } as BaremeAmountDraft
}

// Construit un jeu de montants conforme à un contrat (compte exact, codes requis).
function buildConformingAmounts(sheetName: string): { sheets: ParsedSheet[]; amounts: BaremeAmountDraft[] } {
  const c = BAREME_CONTRACTS.find((x) => x.sheetName === sheetName)!
  const amounts: BaremeAmountDraft[] = []
  const codes = c.requiredCodes ?? ['x']
  for (let i = 0; i < c.expectedCount; i++) {
    amounts.push(amt(c.sheetName, c.category, codes[i % codes.length] + (i < codes.length ? '' : `_${i}`)))
  }
  return { sheets: [sheet(c.sheetName)], amounts }
}

describe('verifySheetContracts', () => {
  it('aucune alerte quand une feuille est conforme (compte + codes)', () => {
    const { sheets, amounts } = buildConformingAmounts('Activering_Activation')
    const res = verifySheetContracts(sheets, amounts)
    const actAlerts = res.alerts.filter((a) => /Activering/.test(a.sheet ?? ''))
    expect(actAlerts).toHaveLength(0)
    expect(res.results.find((r) => r.sheet === 'Activering_Activation')?.status).toBe('ok')
  })

  it('erreur si une feuille attendue est absente', () => {
    const res = verifySheetContracts([], [])
    const absent = res.results.filter((r) => r.status === 'absent')
    expect(absent.length).toBe(BAREME_CONTRACTS.length)
    expect(res.alerts.some((a) => a.level === 'error' && /absente/i.test(a.title ?? ''))).toBe(true)
  })

  it('erreur de perte massive si compte sous le plancher', () => {
    // Activering : minCount 10 → 5 montants déclenche collapse
    const amounts = Array.from({ length: 5 }, (_, i) => amt('Activering_Activation', 'activation', `c${i}`))
    const res = verifySheetContracts([sheet('Activering_Activation')], amounts)
    const r = res.results.find((x) => x.sheet === 'Activering_Activation')
    expect(r?.status).toBe('collapse')
    expect(res.alerts.some((a) => a.level === 'error' && /Perte massive/i.test(a.title ?? ''))).toBe(true)
  })

  it('warning de déviation si compte ≠ attendu (mais au-dessus du plancher)', () => {
    // Bonus : expected 8 → 10 montants = déviation (au-dessus, warning pas erreur)
    const amounts = Array.from({ length: 10 }, (_, i) =>
      amt('Bonus', 'employment_bonus', i < 2 ? ['employee', 'worker'][i] : `t${i}`)
    )
    const res = verifySheetContracts([sheet('Bonus')], amounts)
    const r = res.results.find((x) => x.sheet === 'Bonus')
    expect(r?.status).toBe('deviation')
    expect(res.alerts.some((a) => a.level === 'warn' && /Compte de montants modifié/i.test(a.title ?? ''))).toBe(true)
  })

  it('warning si un code-clé attendu disparaît', () => {
    // W conforme en compte mais sans le code mono-lettre "I" (régression regex)
    const c = BAREME_CONTRACTS.find((x) => x.sheetName === 'W')!
    const codesWithoutI = (c.requiredCodes ?? []).filter((x) => x !== 'I')
    const amounts = Array.from({ length: c.expectedCount }, (_, i) =>
      amt('W ', 'allocation_w', codesWithoutI[i % codesWithoutI.length] + (i < codesWithoutI.length ? '' : `_${i}`))
    )
    const res = verifySheetContracts([sheet('W ')], amounts)
    expect(res.alerts.some((a) => a.level === 'warn' && /Code-clé attendu absent/i.test(a.title ?? '') && /«\s*I\s*»/.test((a as { reason?: string }).reason ?? ''))).toBe(true)
  })

  it('erreur si la catégorie des montants ne correspond pas au contrat', () => {
    const amounts = Array.from({ length: 1500 }, (_, i) => amt('A_N_B_vol_plein', 'half_unemployment', `c${i}`))
    const res = verifySheetContracts([sheet('A_N_B_vol_plein')], amounts)
    const r = res.results.find((x) => x.sheet === 'A_N_B_vol_plein')
    expect(r?.status).toBe('category_mismatch')
    expect(res.alerts.some((a) => a.level === 'error' && /Catégorie de feuille inattendue/i.test(a.title ?? ''))).toBe(true)
  })
})
