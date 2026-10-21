import { describe, expect, it } from 'vitest'
import { getC1BaremeThresholds, getC1IncomeGuidance, formatC1BaremeSource } from '../c1-thresholds'
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
      { article: 'Article 62, al. 2', amount: 700 },
      { article: 'Article 62, al. 3 — ascendant pensionné', amount: 800 },
      { article: 'Article 62, al. 3 — ascendant pensionné handicapé', amount: 900 },
    ]))
    expect(thresholds.spouseProfessionalMonthly).toBe(1010.63)
    expect(thresholds.childProfessionalMonthly).toBe(541.21)
    expect(thresholds.spouseReplacementMonthly).toBe(839.92)
    expect(thresholds.childReplacementMonthly).toBe(646.88)
    expect(thresholds.ascendantPensionWithChildMonthly).toBe(700)
    expect(thresholds.ascendantPensionMonthly).toBe(800)
    expect(thresholds.ascendantDisabledPensionMonthly).toBe(900)
    expect(thresholds.source?.validFrom?.toISOString().slice(0, 10)).toBe('2026-04-01')
  })

  it('retourne un message et les preuves quand le montant est sous le seuil', () => {
    const thresholds = getC1BaremeThresholds(data([{ article: 'Article 60, al. 2', amount: 1000 }]))
    const guidance = getC1IncomeGuidance('spouseProfessional', 900, thresholds)
    expect(guidance.belowThreshold).toBe(true)
    expect(guidance.message).toContain('chef de ménage')
    expect(guidance.evidence).toContain('Composition de ménage')
  })
})

describe('C1 extraction sans repli implicite', () => {
  it('distingue un barème absent et une ligne manquante sans importer un montant T147', () => {
    const absent = getC1BaremeThresholds(null)
    expect(absent.source).toBeNull()
    expect(absent.spouseProfessionalMonthly).toBeNull()
    expect(absent.issues?.spouseProfessionalMonthly).toBe('missing')
    const partial = getC1BaremeThresholds(data([{ article: 'Article 60, al. 2', amount: 111 }]))
    expect(partial.childProfessionalMonthly).toBeNull()
    expect(partial.issues?.childProfessionalMonthly).toBe('missing')
    expect(partial.source?.publishedAt).toEqual(new Date('2026-04-02'))
  })

  it('accepte des doublons concordants et signale les doublons contradictoires quel que soit leur ordre', () => {
    const same = [{ article: 'Article 60, al. 2', amount: 111 }, { article: 'Article 60, al. 2', amount: 111 }]
    expect(getC1BaremeThresholds(data(same)).spouseProfessionalMonthly).toBe(111)
    expect(getC1BaremeThresholds(data(same)).issues?.spouseProfessionalMonthly).toBeUndefined()
    const conflict = [{ article: 'Article 60, al. 2', amount: 111 }, { article: 'Article 60, al. 2', amount: 222 }]
    for (const rows of [conflict, [...conflict].reverse()]) {
      const result = getC1BaremeThresholds(data(rows))
      expect(result.spouseProfessionalMonthly).toBeNull()
      expect(result.issues?.spouseProfessionalMonthly).toBe('conflicting')
      expect(result.childProfessionalMonthly).toBeNull()
      expect(result.issues?.childProfessionalMonthly).toBe('missing')
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('écarte une ligne de montant invalide : %s', (amount) => {
    const result = getC1BaremeThresholds(data([{ article: 'Article 60, al. 2', amount }]))
    expect(result.spouseProfessionalMonthly).toBeNull()
    expect(result.issues?.spouseProfessionalMonthly).toBe('invalid')
  })

  it('accepte zéro et conserve séparément les montants synthétiques des versions datées', () => {
    expect(getC1BaremeThresholds(data([{ article: 'Article 60, § 2', amount: 0 }])).spouseProfessionalMonthly).toBe(0)
    const v1 = data([{ article: 'Article 60, al. 2', amount: 111 }])
    const v2 = { ...data([{ article: 'Article 60, al. 2', amount: 222 }]), fileId: 'v2', validFrom: new Date('2026-07-01') }
    expect(getC1BaremeThresholds(v1).spouseProfessionalMonthly).toBe(111)
    expect(getC1BaremeThresholds(v2)).toMatchObject({ spouseProfessionalMonthly: 222, source: { fileId: 'v2', validFrom: new Date('2026-07-01') } })
  })

  it.each(['fr', 'en', 'ar'] as const)('formate la date civile fixe avec la locale %s', (locale) => {
    const thresholds = getC1BaremeThresholds(data([]))
    expect(formatC1BaremeSource(thresholds, locale)).toContain('01/04/2026')
  })
})
