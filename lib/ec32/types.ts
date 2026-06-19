// =====================================================================
//  eC3.2 — Types & énumérations du domaine (pur, server-safe)
// ---------------------------------------------------------------------
//  Source de vérité des énumérations métier + types runtime du
//  simulateur pédagogique. AUCUNE dépendance React / Zod ici, pour que
//  ce module soit importable côté serveur (schéma, validation) comme
//  côté client (simulateur). Les TYPES DE CONTENU éditable (textes du
//  builder) vivent dans `schema.ts` et sont dérivés du schéma Zod.
// =====================================================================

// ─────────────────────────── Situations encodables ───────────────────────────

/**
 * Types de situation d'une case du calendrier eC3.2.
 * - Les 8 premières sont sélectionnables par l'utilisateur (sauf `temporary_unemployment`
 *   qui est la valeur par défaut "rien à indiquer").
 * - `not_applicable` et `first_effective_unemployment_day` sont AUTOMATIQUES
 *   (jamais choisies manuellement).
 */
export const EC32_SITUATION_TYPES = [
  'temporary_unemployment', // Chômage temporaire (défaut)
  'work_own_employer', // Travail chez l'employeur (qui remplit la carte)
  'work_elsewhere_usual_day', // Travail ailleurs, un jour normalement travaillé
  'work_elsewhere_non_usual_day', // Travail ailleurs, un jour normalement non travaillé
  'work_other_regular_employer', // Travail auprès d'un autre employeur habituel
  'incapacity', // Inaptitude au travail (maladie, accident, repos d'accouchement)
  'vacation', // Vacances
  'other', // Autre situation (férié, formation rémunérée, etc.)
  'not_applicable', // Pas d'application (case grisée, hors contrat / hors mois) — auto
  'first_effective_unemployment_day', // Premier jour de chômage effectif — auto
] as const

export type Ec32SituationType = (typeof EC32_SITUATION_TYPES)[number]

/** Situations réellement proposées dans le sélecteur (dans l'ordre d'affichage). */
export const EC32_SELECTABLE_SITUATIONS = [
  'temporary_unemployment',
  'work_own_employer',
  'work_elsewhere_usual_day',
  'work_elsewhere_non_usual_day',
  'work_other_regular_employer',
  'incapacity',
  'vacation',
  'other',
] as const satisfies readonly Ec32SituationType[]

/** Sous-groupe "Travail ailleurs" du sélecteur. */
export const EC32_WORK_ELSEWHERE_SITUATIONS = [
  'work_elsewhere_usual_day',
  'work_elsewhere_non_usual_day',
  'work_other_regular_employer',
] as const satisfies readonly Ec32SituationType[]

/** Situations automatiques (jamais choisies à la main). */
export const EC32_AUTO_SITUATIONS = [
  'not_applicable',
  'first_effective_unemployment_day',
] as const satisfies readonly Ec32SituationType[]

// ─────────────────────────── Statuts & contextes ───────────────────────────

export const EC32_CARD_STATUSES = ['draft', 'ready_to_send', 'sent', 'locked'] as const
export type Ec32CardStatus = (typeof EC32_CARD_STATUSES)[number]

export const EC32_EMPLOYER_TYPES = [
  'single', // un seul employeur
  'multiple', // plusieurs employeurs
  'construction_cp124', // secteur construction (CP 124)
  'cp327_exception', // CP 327 (dérogation permanente)
] as const
export type Ec32EmployerType = (typeof EC32_EMPLOYER_TYPES)[number]

export const EC32_PAYMENT_AFFILIATION = ['affiliated', 'not_affiliated'] as const
export type Ec32PaymentAffiliationStatus = (typeof EC32_PAYMENT_AFFILIATION)[number]

// ─────────────────────────── Étapes du simulateur ───────────────────────────

export const EC32_STEPS = [
  'login', // 1. Connexion simulée
  'declaration', // 2. Déclaration sur l'honneur
  'employer', // 3. Choix de l'employeur
  'month', // 4. Choix du mois
  'calendar', // 5. Remplir le calendrier
  'correction', // 6. Corriger une erreur
  'verify', // 7. Vérifier
  'send', // 8. Envoyer
] as const
export type Ec32StepKey = (typeof EC32_STEPS)[number]

// ─────────────────────────── Modèles runtime ───────────────────────────

/** Une correction journalisée sur une case (carte non envoyée uniquement). */
export interface Ec32Correction {
  /** Date ISO `yyyy-mm-dd` du jour corrigé. */
  date: string
  from: Ec32SituationType
  to: Ec32SituationType
  /** Explication obligatoire fournie par l'utilisateur. */
  reason: string
}

/** Une case (jour) de la grille calendrier. */
export interface Ec32DayCell {
  /** Date ISO `yyyy-mm-dd`. */
  date: string
  /** Numéro du jour dans le mois (1..31). */
  day: number
  /** Jour de la semaine 0 (dimanche)..6 (samedi). */
  weekday: number
  /** Appartient au mois sélectionné. */
  inMonth: boolean
  /** Encodable (faux ⇒ grisé, `not_applicable` : hors mois / hors contrat). */
  selectable: boolean
  /** Situation actuellement enregistrée. */
  situation: Ec32SituationType
  /** Premier jour de chômage effectif (icône automatique). */
  isFirstEffectiveDay?: boolean
  /** Dernière correction appliquée à ce jour (le cas échéant). */
  correction?: Ec32Correction | null
}

/**
 * Comportement (logique) d'un mois de démonstration — distinct des libellés
 * éditables. Vit dans `rules.ts`, indexé par `key` (`yyyy-mm`).
 */
export interface Ec32MonthBehavior {
  key: string
  year: number
  /** Mois 1..12. */
  month: number
  /** Statut initial de la carte pour ce mois (`sent`/`locked` = verrouillé). */
  status: Ec32CardStatus
  /** Jour du mois (1..31) à partir duquel l'envoi devient possible. */
  firstSendDay: number
  /** Premier jour de chômage effectif (icône auto), si applicable. */
  firstEffectiveDay?: number
  /** Début de contrat dans le mois (jours antérieurs grisés), si applicable. */
  contractStartDay?: number
  /** Fin de contrat dans le mois (jours postérieurs grisés), si applicable. */
  contractEndDay?: number
}

/**
 * Préréglage appliqué quand un cas pratique est chargé dans le simulateur.
 * Vit dans `rules.ts`, indexé par `scenario.key`.
 */
export interface Ec32ScenarioPreset {
  /** Étape sur laquelle atterrir. */
  step: Ec32StepKey
  employerId?: string
  monthKey?: string
  paymentAffiliation?: Ec32PaymentAffiliationStatus
  /** Situation suggérée à appliquer (mise en avant dans le sélecteur). */
  suggestedSituation?: Ec32SituationType
  /** Jours-cibles à présélectionner pour l'exercice. */
  targetDays?: number[]
  /** Astuce contextuelle affichée par le coach. */
  hint?: string
}

/** Vue active du simulateur (calendrier vs liste). */
export type Ec32CardView = 'calendar' | 'list'
