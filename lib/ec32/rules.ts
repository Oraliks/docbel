// =====================================================================
//  eC3.2 — Règles & logique du simulateur (pur, server-safe)
// ---------------------------------------------------------------------
//  Comportements des mois de démonstration, préréglages des cas
//  pratiques et génération de la grille calendrier. AUCUNE dépendance
//  React : ce module est importable côté serveur comme côté client.
//  `new Date(y, m, d)` n'est utilisé que pour calculer des jours de la
//  semaine de façon déterministe (dates fixes 2025), jamais `Date.now()`.
// =====================================================================

import type {
  Ec32DayCell,
  Ec32MonthBehavior,
  Ec32ScenarioPreset,
} from './types'

// ─────────────────────────── Comportements des mois ───────────────────────────

/**
 * Comportement logique de chacune des 4 cartes de démonstration, indexé
 * par clé `yyyy-mm`. Distinct des libellés éditables (`simulator.months`).
 * - `2025-05` : mois « en cours » (envoi d'abord bloqué, débloqué au 28).
 * - `2025-06` : mois suivant (envoi pas encore possible).
 * - `2025-04` : mois précédent non envoyé (envoi déjà possible).
 * - `2025-03` : carte envoyée et verrouillée.
 */
export const EC32_MONTH_BEHAVIORS: Record<string, Ec32MonthBehavior> = {
  '2025-05': {
    key: '2025-05',
    year: 2025,
    month: 5,
    status: 'draft',
    firstSendDay: 28,
    firstEffectiveDay: 5,
  },
  '2025-06': {
    key: '2025-06',
    year: 2025,
    month: 6,
    status: 'draft',
    firstSendDay: 27,
  },
  '2025-04': {
    key: '2025-04',
    year: 2025,
    month: 4,
    status: 'draft',
    firstSendDay: 28,
    firstEffectiveDay: 7,
  },
  '2025-03': {
    key: '2025-03',
    year: 2025,
    month: 3,
    status: 'sent',
    firstSendDay: 28,
    firstEffectiveDay: 4,
  },
}

// ─────────────────────────── Préréglages des cas pratiques ───────────────────────────

/**
 * Préréglage appliqué au chargement d'un cas pratique dans le simulateur,
 * indexé par `scenario.key` (14 scénarios). Chaque preset positionne le
 * simulateur sur la bonne étape avec le bon employeur / mois et, le cas
 * échéant, suggère une situation et des jours-cibles à encoder.
 */
export const EC32_SCENARIO_PRESETS: Record<string, Ec32ScenarioPreset> = {
  // Remplir tout le mois en chômage temporaire (cas le plus simple).
  'all-month': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'temporary_unemployment',
    hint:
      'Par défaut, tout le mois est déjà considéré comme « Chômage ». Vous n’avez rien à modifier : passez à la vérification.',
  },
  // Travail chez l'employeur qui remplit la carte.
  'work-own': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'work_own_employer',
    targetDays: [6, 7],
    hint:
      'Sélectionnez les jours travaillés, puis choisissez « Travail chez l’employeur ».',
  },
  // Travail ailleurs, un jour normalement travaillé.
  'work-elsewhere-usual': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'work_elsewhere_usual_day',
    targetDays: [8],
    hint:
      'Sélectionnez le jour, puis choisissez « Travail ailleurs — un jour normalement travaillé ». Tout travail doit être enregistré avant de commencer.',
  },
  // Travail ailleurs, un jour normalement NON travaillé (week-end).
  'work-elsewhere-weekend': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'work_elsewhere_non_usual_day',
    targetDays: [10, 11],
    hint:
      'Sélectionnez le samedi et le dimanche, puis choisissez « Travail ailleurs — un jour normalement non travaillé ».',
  },
  // Travail auprès d'un autre employeur habituel.
  'other-regular': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'work_other_regular_employer',
    targetDays: [13],
    hint:
      'Sélectionnez le jour, puis choisissez « Travail auprès d’un autre employeur habituel ».',
  },
  // Maladie / inaptitude au travail.
  sick: {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'incapacity',
    targetDays: [12, 13, 14],
    hint:
      'Sélectionnez les jours de maladie puis choisissez « Inaptitude au travail ».',
  },
  // Vacances.
  vacation: {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'vacation',
    targetDays: [19, 20, 21],
    hint: 'Sélectionnez les jours de vacances puis choisissez « Vacances ».',
  },
  // Autre situation (jour férié, formation rémunérée, etc.).
  'other-situation': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    suggestedSituation: 'other',
    targetDays: [1],
    hint:
      'Le 1er mai est un jour férié : sélectionnez-le puis choisissez « Autre situation ».',
  },
  // Plusieurs employeurs : choisir le bon.
  'multiple-employers': {
    step: 'employer',
    employerId: 'emp-b',
    monthKey: '2025-05',
    hint:
      'Avec plusieurs employeurs, choisissez celui qui vous a mis en chômage temporaire ; vos autres occupations s’indiquent sur cette carte.',
  },
  // Pas d'organisme de paiement : l'envoi est bloqué.
  // Mois « Avril 2025 » : la première date d'envoi est déjà atteinte, donc le
  // SEUL blocage démontré est l'absence d'organisme de paiement (le but du cas).
  'no-payment-org': {
    step: 'send',
    employerId: 'emp-a',
    monthKey: '2025-04',
    paymentAffiliation: 'not_affiliated',
    hint: 'Essayez d’envoyer la carte : l’envoi est bloqué tant que vous n’êtes pas affilié à un organisme de paiement.',
  },
  // Corriger une erreur sur une carte non envoyée.
  correction: {
    step: 'correction',
    employerId: 'emp-a',
    monthKey: '2025-04',
    hint:
      'Sur une carte non envoyée, ouvrez un jour déjà encodé pour le corriger : une explication est obligatoire.',
  },
  // Secteur construction (CP 124) : la carte doit toujours être remplie.
  'construction-cp124': {
    step: 'employer',
    employerId: 'emp-construction',
    monthKey: '2025-05',
    suggestedSituation: 'temporary_unemployment',
    hint:
      'Dans la construction (CP 124), la carte doit toujours être complétée, même lorsque vous travaillez.',
  },
  // Premier jour de chômage effectif (icône automatique).
  'first-effective-day': {
    step: 'calendar',
    employerId: 'emp-a',
    monthKey: '2025-05',
    targetDays: [5],
    hint:
      'Repérez l’icône automatique du premier jour de chômage effectif (le 5 mai) : elle n’est jamais saisie à la main.',
  },
  // Mauvais mois : compléter la carte du bon mois.
  'wrong-month': {
    step: 'month',
    employerId: 'emp-a',
    monthKey: '2025-04',
    hint:
      'Vérifiez le mois avant de compléter : ici, c’est la carte d’avril 2025 qui doit être remplie.',
  },
}

// ─────────────────────────── Accès & helpers ───────────────────────────

/** Renvoie le comportement d'un mois par sa clé `yyyy-mm`, ou `undefined`. */
export function getMonthBehavior(key: string): Ec32MonthBehavior | undefined {
  return EC32_MONTH_BEHAVIORS[key]
}

/** Nombre de jours du mois (1..12) pour une année donnée. */
export function lastDayOfMonth(year: number, month: number): number {
  // Le jour 0 du mois suivant = dernier jour du mois courant.
  return new Date(year, month, 0).getDate()
}

/** Noms de mois en français (index 1..12). */
const FRENCH_MONTHS: readonly string[] = [
  '',
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

// ─────────────────────────── Génération de la grille ───────────────────────────

/**
 * Construit la grille calendrier d'un mois : des semaines complètes
 * (lundi → dimanche) couvrant l'intégralité du mois. Pour chaque case :
 * - `date` ISO `yyyy-mm-dd`, `day`, `weekday` (0 = dimanche … 6 = samedi) ;
 * - `inMonth` vrai si la case appartient au mois sélectionné ;
 * - `selectable` faux (situation `not_applicable`) si la case est hors mois,
 *   avant `contractStartDay` ou après `contractEndDay` ; vrai sinon
 *   (situation par défaut `temporary_unemployment`) ;
 * - `isFirstEffectiveDay` vrai uniquement au jour `firstEffectiveDay` du mois ;
 * - `correction` initialisée à `null`.
 */
export function generateMonthGrid(behavior: Ec32MonthBehavior): Ec32DayCell[] {
  const { year, month, firstEffectiveDay, contractStartDay, contractEndDay } =
    behavior
  const daysInMonth = lastDayOfMonth(year, month)

  // Jour de la semaine du 1er du mois, recalé sur un début lundi.
  // getDay(): 0 = dimanche … 6 = samedi → offset lundi = (getDay + 6) % 7.
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const leadingBlanks = (firstWeekday + 6) % 7

  // Premier jour affiché = lundi de la 1re semaine (peut être en mois précédent).
  const startDate = new Date(year, month - 1, 1 - leadingBlanks)

  // Nombre total de cases = semaines complètes recouvrant le mois.
  const totalSpan = leadingBlanks + daysInMonth
  const weeks = Math.ceil(totalSpan / 7)
  const totalCells = weeks * 7

  const cells: Ec32DayCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + i,
    )
    const cellYear = d.getFullYear()
    const cellMonth = d.getMonth() + 1 // 1..12
    const day = d.getDate()
    const weekday = d.getDay() // 0 = dimanche … 6 = samedi
    const inMonth = cellYear === year && cellMonth === month

    const beforeContract =
      inMonth && contractStartDay !== undefined && day < contractStartDay
    const afterContract =
      inMonth && contractEndDay !== undefined && day > contractEndDay
    const selectable = inMonth && !beforeContract && !afterContract

    const date = `${cellYear}-${pad2(cellMonth)}-${pad2(day)}`

    cells.push({
      date,
      day,
      weekday,
      inMonth,
      selectable,
      situation: selectable ? 'temporary_unemployment' : 'not_applicable',
      isFirstEffectiveDay:
        inMonth &&
        firstEffectiveDay !== undefined &&
        day === firstEffectiveDay,
      correction: null,
    })
  }

  return cells
}

/** Zéro-padding sur 2 chiffres. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// ─────────────────────────── Dates & envoi ───────────────────────────

/**
 * Libellé lisible de la première date d'envoi possible, p. ex.
 * « 28 mai 2025 ». On préfixe le jour d'envoi au libellé du mois
 * (`monthLabel`, p. ex. « Mai 2025 ») en mettant son initiale en
 * minuscule pour une lecture naturelle ; repli sur le nom de mois dérivé
 * du behavior si `monthLabel` est vide.
 */
export function getFirstSendDateLabel(
  behavior: Ec32MonthBehavior,
  monthLabel: string,
): string {
  const trimmed = monthLabel.trim()
  const monthPart = trimmed
    ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
    : `${FRENCH_MONTHS[behavior.month] ?? ''} ${behavior.year}`.trim()
  return `${behavior.firstSendDay} ${monthPart}`
}

/**
 * Jour « simulé » initial dans le mois, pilotant si l'envoi est possible
 * au chargement :
 * - mois en cours `2025-05` : un jour AVANT `firstSendDay` (envoi bloqué) ;
 * - mois passé non envoyé : dernier jour du mois (envoi possible) ;
 * - mois envoyé (`status === 'sent'`/`locked`) : dernier jour du mois ;
 * - mois suivant `2025-06` : 1 (envoi pas encore possible).
 */
export function initialSimulatedDay(behavior: Ec32MonthBehavior): number {
  const lastDay = lastDayOfMonth(behavior.year, behavior.month)

  // Mois suivant : on est tout début de mois, l'envoi n'est pas encore ouvert.
  if (behavior.key === '2025-06') {
    return 1
  }

  // Mois envoyé / verrouillé : on se place en fin de mois.
  if (behavior.status === 'sent' || behavior.status === 'locked') {
    return lastDay
  }

  // Mois en cours : un jour avant la première date d'envoi (envoi bloqué).
  if (behavior.key === '2025-05') {
    return Math.max(1, behavior.firstSendDay - 8)
  }

  // Mois passé non envoyé (et tout autre brouillon) : fin de mois → envoi possible.
  return lastDay
}

/**
 * Indique si l'envoi simulé est autorisé : seulement pour une carte non
 * verrouillée (statut différent de `sent`/`locked`) ET dès que le jour
 * simulé atteint la première date d'envoi possible.
 */
export function isSendAllowed(
  behavior: Ec32MonthBehavior,
  simulatedDay: number,
): boolean {
  if (behavior.status === 'sent' || behavior.status === 'locked') {
    return false
  }
  return simulatedDay >= behavior.firstSendDay
}
