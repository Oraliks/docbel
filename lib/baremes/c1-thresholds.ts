import type { ActiveBaremeAmount, ActiveBaremeData } from './getActiveBaremeData'
import { defaultLocale, type Locale } from '@/i18n/locales'
import { formatDate } from '@/lib/i18n/format'

export type C1IncomeRole = 'spouseProfessional' | 'childProfessional' | 'spouseReplacement' | 'childReplacement'
export type C1BaremeThresholdKey =
  | 'spouseProfessionalMonthly'
  | 'childProfessionalMonthly'
  | 'spouseReplacementMonthly'
  | 'childReplacementMonthly'
  | 'ascendantPensionWithChildMonthly'
  | 'ascendantPensionMonthly'
  | 'ascendantDisabledPensionMonthly'
export type C1BaremeThresholdIssue = 'missing' | 'conflicting' | 'invalid'

export interface C1BaremeThresholds {
  spouseProfessionalMonthly: number | null
  childProfessionalMonthly: number | null
  spouseReplacementMonthly: number | null
  childReplacementMonthly: number | null
  ascendantPensionWithChildMonthly?: number | null
  ascendantPensionMonthly?: number | null
  ascendantDisabledPensionMonthly?: number | null
  source: { fileId: string; fileName: string; validFrom: Date | null; publishedAt?: Date | null } | null
  /** Diagnostic technique : un seuil absent ou contradictoire n'est jamais inventé. */
  issues?: Partial<Record<C1BaremeThresholdKey, C1BaremeThresholdIssue>>
}

const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Extrait les seuils depuis le seul fichier applicable sélectionné par le lecteur.
 * Aucun montant de repli, aucune fusion avec une version courante ou précédente.
 * Des doublons concordants sont acceptés ; des valeurs contradictoires restent null.
 */
export function getC1BaremeThresholds(data: ActiveBaremeData | null): C1BaremeThresholds {
  const rows = (data?.amountsByCategory.other_unemployment_amount ?? []).filter(
    (row) => row.unit === 'monthly'
  )
  const issues: Partial<Record<C1BaremeThresholdKey, C1BaremeThresholdIssue>> = {}
  const find = (
    key: C1BaremeThresholdKey,
    article: number,
    paragraph: number,
    labelIncludes: string[] = [],
    labelExcludes: string[] = [],
  ): number | null => {
    const candidates = rows.filter((candidate) => {
      const haystack = normalized(`${candidate.article ?? ''} ${candidate.labelFr ?? ''} ${candidate.labelNl ?? ''}`)
      return new RegExp(`\\b${article}\\b[\\s\\S]{0,24}(?:\\b(?:al|aline?a)\\.?|§)\\s*${paragraph}\\b`).test(haystack)
        && labelIncludes.every((term) => haystack.includes(normalized(term)))
        && labelExcludes.every((term) => !haystack.includes(normalized(term)))
    })
    if (candidates.length === 0) {
      issues[key] = 'missing'
      return null
    }
    if (candidates.some((candidate) => !Number.isFinite(candidate.amount) || candidate.amount < 0)) {
      issues[key] = 'invalid'
      return null
    }
    const values = new Set(candidates.map((candidate) => candidate.amount))
    if (values.size !== 1) {
      issues[key] = 'conflicting'
      return null
    }
    return candidates[0].amount
  }

  return {
    spouseProfessionalMonthly: find('spouseProfessionalMonthly', 60, 2),
    childProfessionalMonthly: find('childProfessionalMonthly', 60, 3),
    spouseReplacementMonthly: find('spouseReplacementMonthly', 61, 2),
    childReplacementMonthly: find('childReplacementMonthly', 62, 1),
    ascendantPensionWithChildMonthly: find('ascendantPensionWithChildMonthly', 62, 2),
    ascendantPensionMonthly: find('ascendantPensionMonthly', 62, 3, ['ascendant'], ['handicap']),
    ascendantDisabledPensionMonthly: find('ascendantDisabledPensionMonthly', 62, 3, ['ascendant', 'handicap']),
    source: data ? {
      fileId: data.fileId,
      fileName: data.fileName,
      validFrom: data.validFrom,
      publishedAt: data.publishedAt,
    } : null,
    issues,
  }
}
export interface C1IncomeGuidance {
  belowThreshold: boolean | null
  message: string
  evidence: string[]
}

/** Message court affichable sous un montant libre dans le Form Runner. */
export function getC1IncomeGuidance(
  role: C1IncomeRole,
  amount: number | null,
  thresholds: C1BaremeThresholds
): C1IncomeGuidance {
  const threshold = {
    spouseProfessional: thresholds.spouseProfessionalMonthly,
    childProfessional: thresholds.childProfessionalMonthly,
    spouseReplacement: thresholds.spouseReplacementMonthly,
    childReplacement: thresholds.childReplacementMonthly,
  }[role]
  if (amount === null || !Number.isFinite(amount) || threshold === null) {
    return {
      belowThreshold: null,
      message: 'Le montant sera vérifié avec le barème ONEM actuellement publié.',
      evidence: ['Preuve du revenu (fiche de paie ou attestation de l’organisme payeur)'],
    }
  }
  const belowThreshold = amount <= threshold
  const formatted = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(threshold)
  return {
    belowThreshold,
    message: belowThreshold
      ? `Vous ne dépassez pas le seuil de ${formatted}. Vous pouvez peut-être prétendre au statut de chef de ménage, sous réserve de vérification.`
      : `Le montant dépasse le seuil de ${formatted} : le statut de cohabitant peut s'appliquer, sous réserve de vérification.`,
    evidence: belowThreshold
      ? ['Fiche(s) de paie ou attestation de revenu', 'Contrat de travail et durée (CDI/CDD)', 'Composition de ménage']
      : ['Fiche(s) de paie ou attestation de revenu', 'Contrat de travail et durée (CDI/CDD)'],
  }
}

export function formatC1BaremeSource(thresholds: C1BaremeThresholds, locale: Locale = defaultLocale): string | null {
  if (!thresholds.source) return null
  const date = thresholds.source.validFrom
    ? formatDate(`${thresholds.source.validFrom.toISOString().slice(0, 10)}T12:00:00`, locale)
    : null
  return `Barème appliqué : ${thresholds.source.fileName}${date ? ` (valable depuis le ${date})` : ''}.`
}

export type { ActiveBaremeAmount }
