/**
 * Paramètres réglementaires du chômage complet — jeux DATÉS et SOURCÉS.
 *
 * SOURCE DE VÉRITÉ UNIQUE des montants (plafonds salariaux, taux, forfaits).
 * Une réforme ou une indexation = un NOUVEAU jeu ajouté à CHOMAGE_PARAM_SETS
 * (l'ancien reste, borné par `validTo`) — jamais une constante écrasée.
 * Les consommateurs résolvent par date via `getChomageParams(date)`.
 *
 * Pourquoi en code et pas en DB : un calcul légal doit être typé, testé,
 * reviewé (diff git) et reproductible. La base barèmes importée de l'ONEM
 * (BaremeFile/BaremeAmount, admin 4 yeux) sert de source de VÉRIFICATION :
 * un test de parité confrontera ces valeurs au dernier barème publié
 * (cf. audit docs/audits/AUDIT_ARCHITECTURE_CHOMAGE_2026-07-04.md, lot 2).
 *
 * Module de domaine pur : aucune dépendance UI / Prisma / i18n.
 */

import type { ChomagePhase, SituationFamiliale } from "./categories";

/** Référence vers la source officielle d'un paramètre ou d'une règle. */
export interface SourceRef {
  /** Libellé humain, ex. "ONEM — barèmes au 01/03/2026". */
  label: string;
  /** URL officielle (page ONEM, Moniteur…). */
  url?: string;
  /** Identifiant d'article dans le corpus RioLex (/partenaire/reglementation). */
  riolexId?: string;
  /** Date (ISO) de dernière vérification humaine de la valeur. */
  verifiedAt: string;
}

/**
 * Jeu de valeurs valable sur une période. `validTo` absent = en vigueur.
 * Convention de bornes : validFrom INCLUS, validTo EXCLU.
 */
export interface VersionedParams<T> {
  /** Date d'entrée en vigueur (ISO "YYYY-MM-DD"), incluse. */
  validFrom: string;
  /** Date de fin (ISO), EXCLUE. Absent = toujours en vigueur. */
  validTo?: string;
  /** Libellé humain du jeu, ex. "Réforme chômage mars 2026". */
  label: string;
  source: SourceRef;
  values: T;
}

/**
 * Phases proportionnelles = 1ʳᵉ période (mois 1-12), seules à avoir un plafond
 * salarial propre. La 2ᵉ période (2B, mois 13-24) est forfaitaire : montant à
 * vérifier, aucun barème chiffré ici (cf. TODO_SOURCE_OFFICIELLE, barème ONEM
 * en refonte) — voir docs/knowledge/chomage/chomage-complet.md.
 */
export type PhaseProportionnelle = Extract<ChomagePhase, "1A" | "1B" | "2A">;

/** Montants réglementaires du chômage complet (€/mois sauf mention). */
export interface ChomageParams {
  /** Plafonds salariaux mensuels par phase proportionnelle (1ʳᵉ période). */
  plafonds: Record<PhaseProportionnelle, number>;
  /** Taux appliqués au salaire plafonné : 1A puis toutes les autres phases. */
  taux: { "1A": number; autres: number };
  /** Plancher mensuel par situation familiale (1ʳᵉ période). */
  forfaitMin: Record<SituationFamiliale, number>;
  /** Plafond mensuel par situation familiale (1ʳᵉ période). */
  forfaitMax: Record<SituationFamiliale, number>;
}

/**
 * Jeux de paramètres, du plus récent au plus ancien.
 * ⚠️ Montants = ESTIMATIONS INDICATIVES documentées (voir SourceRef) ; le
 * chiffre exact relève de l'organisme de paiement. Repris À L'IDENTIQUE des
 * constantes historiques de lib/calculators/chomage.ts (extraction lot 1,
 * aucun montant modifié).
 */
export const CHOMAGE_PARAM_SETS: readonly VersionedParams<ChomageParams>[] = [
  {
    validFrom: "2026-03-01",
    label: "Réforme chômage mars 2026",
    source: {
      label:
        'ONEM — "À combien s\'élève votre allocation de chômage" (barèmes au 01/03/2026)',
      url: "https://www.onem.be/fr/documentation/baremes",
      verifiedAt: "2026-07-04",
    },
    values: {
      plafonds: {
        "1A": 4265.98, // mois 1-3 (plafond A)
        "1B": 4010.98, // mois 4-6 (plafond A bis, introduit par la réforme 2026)
        "2A": 3262.99, // mois 7-12 (plafond B)
        // mois 13-24 (2ᵉ période) = forfait familial, montant à vérifier : pas
        // de plafond salarial (réforme 2026, cf. degressivite_structure).
      },
      taux: { "1A": 0.65, autres: 0.6 },
      forfaitMin: { chef_menage: 1500, isole: 1260, cohabitant: 1015 },
      forfaitMax: { chef_menage: 2200, isole: 1850, cohabitant: 1500 },
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Allocations d'insertion (feuille W du barème ONEM)                 */
/* ------------------------------------------------------------------ */

/**
 * Montants BRUTS des allocations d'insertion, en €/JOUR (régime 6 jours —
 * mensuel = journalier × 26, cf. `mensuelBrut`). Catégories et bandes d'âge
 * = celles de la page officielle ONEM.
 *
 * Correspondance vérifiée (2026-07-05) avec la feuille W du barème publié
 * (fixture lib/chomage/__fixtures__/bareme-publie.json) :
 *   chargeFamille        → allocation_w:WA2:full  (libellé "M 6 ->")
 *   isole (3 âges)       → allocation_w:WN2:full:{lt18,gt18_lt21,gt21}
 *   cohabitantPrivilegie → allocation_w:WP2:full:{lt18,gt18}
 *   cohabitant           → allocation_w:WB2:full:{lt18,gt18}
 *
 * ⚠️ NOTE MÉTIER (à confirmer par Oraliks) : la feuille W contient aussi une
 * variante WA2V "charge de famille M 1 -> 5" à 71,97 €/j, ABSENTE de la page
 * publique ONEM (qui n'affiche que 69,26). On encode la valeur publique ;
 * si les 5 premiers mois sont réellement majorés, ajouter la nuance ici.
 */
export interface InsertionParams {
  montantsJour: {
    /** Cohabitant avec charge de famille (code W A). */
    chargeFamille: number;
    /** Isolé (code W N), par bande d'âge. */
    isole: { moins18: number; de18a20: number; aPartirDe21: number };
    /** Cohabitant privilégié (code W P). */
    cohabitantPrivilegie: { moins18: number; aPartirDe18: number };
    /** Cohabitant ordinaire / non privilégié (code W B). */
    cohabitant: { moins18: number; aPartirDe18: number };
  };
}

export const INSERTION_PARAM_SETS: readonly VersionedParams<InsertionParams>[] = [
  {
    validFrom: "2026-03-01",
    label: "Allocations d'insertion — réforme mars 2026",
    source: {
      label: "ONEM — Montants : allocation d'insertion (au 01/03/2026)",
      url: "https://www.onem.be/documentation/montants/allocation-dinsertion",
      verifiedAt: "2026-07-05",
    },
    values: {
      montantsJour: {
        chargeFamille: 69.26,
        isole: { moins18: 18.93, de18a20: 29.76, aPartirDe21: 51.56 },
        cohabitantPrivilegie: { moins18: 17.67, aPartirDe18: 28.38 },
        cohabitant: { moins18: 15.61, aPartirDe18: 24.88 },
      },
    },
  },
];

/** Mensuel brut ONEM : journalier × 26 jours indemnisables, arrondi au cent. */
export function mensuelBrut(montantJour: number): number {
  return Math.round(montantJour * 26 * 100) / 100;
}

/* ------------------------------------------------------------------ */
/*  Résolution par date                                                */
/* ------------------------------------------------------------------ */

/** Date civile locale au format ISO "YYYY-MM-DD" (jour belge, pas UTC). */
function toIsoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Résout le jeu en vigueur à une date (validFrom inclus, validTo exclu).
 * @throws Error explicite si aucun jeu ne couvre la date — on préfère
 * échouer bruyamment plutôt que calculer avec un barème du mauvais régime.
 */
function resolveParamSet<T>(
  sets: readonly VersionedParams<T>[],
  date: Date,
  domaine: string,
): VersionedParams<T> {
  const iso = toIsoDay(date);
  const match = sets.find(
    (set) => set.validFrom <= iso && (!set.validTo || iso < set.validTo),
  );
  if (!match) {
    const known = sets
      .map((s) => `${s.validFrom} → ${s.validTo ?? "en vigueur"}`)
      .join(", ");
    throw new Error(
      `Aucun jeu de paramètres ${domaine} ne couvre la date ${iso}. Périodes connues : ${known}.`,
    );
  }
  return match;
}

/** Paramètres du chômage complet en vigueur à la date donnée (défaut : aujourd'hui). */
export function getChomageParams(
  date: Date = new Date(),
): VersionedParams<ChomageParams> {
  return resolveParamSet(CHOMAGE_PARAM_SETS, date, "chômage");
}

/** Paramètres des allocations d'insertion en vigueur à la date donnée. */
export function getInsertionParams(
  date: Date = new Date(),
): VersionedParams<InsertionParams> {
  return resolveParamSet(INSERTION_PARAM_SETS, date, "insertion");
}
