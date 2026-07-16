import type { ActiveBaremeAmount, ActiveBaremeData } from './getActiveBaremeData'

export type C1IncomeRole = 'spouseProfessional' | 'childProfessional' | 'spouseReplacement' | 'childReplacement'

export interface C1BaremeThresholds {
  spouseProfessionalMonthly: number | null
  childProfessionalMonthly: number | null
  spouseReplacementMonthly: number | null
  childReplacementMonthly: number | null
  source: { fileId: string; fileName: string; validFrom: Date | null } | null
}

/**
 * Extrait les seuils utilisés par le parcours familial depuis le dernier
 * barème publié. Les libellés ONEM pouvant varier (NL/FR), on rapproche par
 * article + unité et jamais par montant codé en dur.
 */
export function getC1BaremeThresholds(data: ActiveBaremeData | null): C1BaremeThresholds {
  const empty: C1BaremeThresholds = {
    spouseProfessionalMonthly: null,
    childProfessionalMonthly: null,
    spouseReplacementMonthly: null,
    childReplacementMonthly: null,
    source: data ? { fileId: data.fileId, fileName: data.fileName, validFrom: data.validFrom } : null,
  }
  if (!data) return empty

  const rows = (data.amountsByCategory.other_unemployment_amount ?? []).filter(
    (row) => row.unit === 'monthly'
  )
  const find = (article: number, paragraph: number): number | null => {
    const row = rows.find((candidate) => {
      const haystack = `${candidate.article ?? ''} ${candidate.labelFr ?? ''} ${candidate.labelNl ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      return new RegExp(`\\b${article}\\b[\\s\\S]{0,24}\\b(?:al|aline?a|§)\\.?\\s*${paragraph}\\b`).test(haystack)
    })
    return row?.amount ?? null
  }

  return {
    ...empty,
    // AM art. 60, al. 2/3 : professionnel conjoint/enfant
    spouseProfessionalMonthly: find(60, 2),
    childProfessionalMonthly: find(60, 3),
    // AM art. 61, al. 2 et art. 62, al. 1 : revenus de remplacement
    spouseReplacementMonthly: find(61, 2),
    childReplacementMonthly: find(62, 1),
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

export function formatC1BaremeSource(thresholds: C1BaremeThresholds): string | null {
  if (!thresholds.source) return null
  const date = thresholds.source.validFrom
    ? new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(thresholds.source.validFrom)
    : null
  return `Barème appliqué : ${thresholds.source.fileName}${date ? ` (valable depuis le ${date})` : ''}.`
}

export type { ActiveBaremeAmount }
