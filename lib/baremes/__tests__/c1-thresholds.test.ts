import { describe, expect, it } from 'vitest'
import { getC1BaremeThresholds, getC1IncomeGuidance } from '../c1-thresholds'
import type { ActiveBaremeData } from '../getActiveBaremeData'

const data = (rows: Array<{ article: string; amount: number }>): ActiveBaremeData => ({
  fileId: 'new',
  fileName: 'bareme-new.xlsx',
  validFrom: new Date('2026-04-01'),
  publishedAt: new Date('2026-04-02'),
  multiplicateur: null,
  amountsByCategory: {
    other_unemployment_amount: rows.map((row, i) => ({
      id: String(i), sourceSheet: 'Autres montants', category: 'other_unemployment_amount',
      allocationCode: null, salaryCode: null, article: row.article, labelFr: null, labelNl: null,
      unit: 'monthly', amount: row.amount, minDailySalary: null, maxDailySalary: null,
      validFrom: new Date('2026-04-01'), comparisonKey: String(i), rate: null,
    })),
  },
  allAmounts: [],
})

describe('C1 barème dynamique', () => {
  it('extrait les seuils AM 60/61/62 sans valeur codée en dur', () => {
    const thresholds = getC1BaremeThresholds(data([
      { article: 'Article 60, al. 2', amount: 1010.63 },
      { article: 'Art. 60, alinéa 3', amount: 541.21 },
      { article: 'Article 61, al. 2', amount: 839.92 },
      { article: 'Article 62, al. 1', amount: 646.88 },
    ]))
    expect(thresholds.spouseProfessionalMonthly).toBe(1010.63)
    expect(thresholds.childProfessionalMonthly).toBe(541.21)
    expect(thresholds.spouseReplacementMonthly).toBe(839.92)
    expect(thresholds.childReplacementMonthly).toBe(646.88)
  })

  it('retourne un message et les preuves quand le montant est sous le seuil', () => {
    const thresholds = getC1BaremeThresholds(data([{ article: 'Article 60, al. 2', amount: 1000 }]))
    const guidance = getC1IncomeGuidance('spouseProfessional', 900, thresholds)
    expect(guidance.belowThreshold).toBe(true)
    expect(guidance.message).toContain('chef de ménage')
    expect(guidance.evidence).toContain('Composition de ménage')
  })
})
