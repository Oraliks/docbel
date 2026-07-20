/**
 * Calcul des allocations de chômage (ONEM Belgique) — barèmes 2026 simplifiés.
 *
 * Pourquoi ce fichier : la logique des allocations ONEM est dégressive sur le
 * temps (phases 1A → 3), modulée par la situation familiale, et plafonnée à
 * trois paliers de salaire. Isoler le calcul ici permet :
 *   1. d'être réutilisable côté SSR / tests / scripts ;
 *   2. de garder le composant React (calc-chomage.tsx) purement présentationnel ;
 *   3. de documenter clairement les sources (ONEM) à un seul endroit.
 *
 * IMPORTANT — Disclaimer technique :
 *   Ces montants sont des ESTIMATIONS INDICATIVES basées sur des barèmes
 *   ONEM publiquement documentés (montants journaliers indexés, périodes de
 *   dégressivité). Le calcul réel intègre encore : précompte professionnel,
 *   carrière passée, dispense pour études, complément d'ancienneté, etc.
 *   Toujours rediriger l'utilisateur vers son organisme de paiement (CAPAC,
 *   votre organisme de paiement habituel) pour le chiffre exact.
 *
 * Sources principales :
 *   - ONEM, "Montants des allocations" (mis à jour à chaque indexation)
 *     https://www.onem.be/fr/documentation/baremes
 *   - Brochure ONEM "Le chômage complet" (phases de dégressivité)
 */

import type {
  ChomagePhase,
  SituationFamiliale,
} from "@/lib/chomage/categories";
import {
  getChomageParams,
  type ChomageParams,
  type PhaseProportionnelle,
} from "@/lib/chomage/params";

/**
 * Types canoniques du domaine (situations familiales, phases de
 * dégressivité) : définis dans lib/chomage/categories.ts, réexportés ici
 * pour ne casser aucun import existant.
 */
export type {
  ChomagePhase,
  SituationFamiliale,
} from "@/lib/chomage/categories";

export interface ChomageInput {
  /** Dernier salaire mensuel brut (€). */
  salaireBrut: number;
  /** Situation familiale au sens ONEM. */
  situationFamiliale: SituationFamiliale;
  /** Phase de chômage courante. */
  phase: ChomagePhase;
}

export interface ChomageResult {
  /** Allocation mensuelle estimée (€), bornée par les forfaits min/max. */
  allocationMensuelle: number;
  /** Allocation journalière (régime 6 jours/semaine, mensuelle / 26). */
  allocationJournaliere: number;
  /** Plafond salarial appliqué pour cette phase (€/mois). */
  plafondApplique: number;
  /** Salaire effectivement pris en compte (= min(brut, plafond)). */
  salairePlafonne: number;
  /** Taux brut appliqué avant bornes forfaitaires (0.65 ou 0.60). */
  tauxApplique: number;
  /** Libellé humain de la situation familiale. */
  situationLabel: string;
  /** Libellé humain de la phase (ex: "Mois 1-3 (1A)"). */
  phaseLabel: string;
}

/**
 * Sortie de `calcChomage`. Union discriminée par `statut` :
 *  - `estime`            : 1ʳᵉ période (mois 1-12), montant chiffré (`ChomageResult`) ;
 *  - `forfait_a_verifier`: 2ᵉ période (2B, mois 13-24), allocation FORFAITAIRE selon
 *                          la catégorie familiale — montant non publié (réforme 2026),
 *                          donc AUCUN chiffre n'est affiché, on renvoie à l'organisme ;
 *  - `error`             : entrées invalides.
 *
 * La fin de droit (au-delà de 24 mois) n'est PAS produite ici : elle est détectée en
 * amont par `phaseFromMonths` (→ "fin_de_droit"), le calcul n'est alors pas appelé.
 */
export type ChomageEstimation =
  | ({ statut: "estime" } & ChomageResult)
  | {
      statut: "forfait_a_verifier";
      /** Libellé humain de la situation familiale (catégorie du forfait). */
      situationLabel: string;
      /** Libellé humain de la phase (ex: "Mois 13-24 (2B)"). */
      phaseLabel: string;
    }
  | { error: string };

/* ------------------------------------------------------------------ */
/*  Barèmes — source de vérité : lib/chomage/params.ts                 */
/* ------------------------------------------------------------------ */

/**
 * Date d'effet du jeu de barèmes EN VIGUEUR (plafonds salariaux + forfaits).
 * Résolue depuis lib/chomage/params.ts — pour réviser les montants à la
 * prochaine indexation ONEM, ajouter un jeu daté LÀ-BAS (jamais ici).
 */
export const BAREME_VERSION = getChomageParams().validFrom;

/* ------------------------------------------------------------------ */
/*  Labels (FR)                                                       */
/* ------------------------------------------------------------------ */

const SITUATION_LABELS: Record<SituationFamiliale, string> = {
  chef_menage: "Chef de ménage",
  isole: "Isolé",
  cohabitant: "Cohabitant",
};

const PHASE_LABELS: Record<ChomagePhase, string> = {
  "1A": "Mois 1-3 (1A)",
  "1B": "Mois 4-6 (1B)",
  "2A": "Mois 7-12 (2A)",
  "2B": "Mois 13-24 (2B)",
};

/**
 * Métadonnées des phases — pour usage dans l'UI (selects, infobulles).
 * 1A/1B/2A = 1ʳᵉ période proportionnelle ; 2B = 2ᵉ période forfaitaire (montant
 * à vérifier). Au-delà de 24 mois : fin de droit (pas une phase — cf. phaseFromMonths).
 */
export const PHASES_INFO: {
  id: ChomagePhase;
  label: string;
  periode_description: string;
}[] = [
  { id: "1A", label: "Mois 1-3", periode_description: "65 % du salaire (plafond A)" },
  { id: "1B", label: "Mois 4-6", periode_description: "60 % du salaire (plafond A bis)" },
  { id: "2A", label: "Mois 7-12", periode_description: "60 % du salaire (plafond B)" },
  { id: "2B", label: "Mois 13-24", periode_description: "Forfait familial (montant à vérifier)" },
];

/**
 * Déduit la phase d'indemnisation à partir de l'ancienneté de chômage (en
 * mois). Source de vérité UNIQUE de la correspondance mois → phase, partagée
 * par le calculateur complet et le simulateur du hero (qui ne couvre que la
 * 1ʳᵉ période). Bornes ONEM (réforme 2026) : 1A (mois 1-3), 1B (4-6), 2A (7-12),
 * 2B (13-24). Au-delà de 24 mois → `"fin_de_droit"` (limitation dans le temps).
 * Un mois ≤ 0 ou non fini est traité comme le mois 1.
 */
export function phaseFromMonths(mois: number): ChomagePhase | "fin_de_droit" {
  const m = Number.isFinite(mois) ? Math.max(1, Math.floor(mois)) : 1;
  if (m <= 3) return "1A";
  if (m <= 6) return "1B";
  if (m <= 12) return "2A";
  if (m <= 24) return "2B";
  return "fin_de_droit";
}

/* ------------------------------------------------------------------ */
/*  Calcul                                                            */
/* ------------------------------------------------------------------ */

/**
 * Pour une phase proportionnelle (1ʳᵉ période : 1A/1B/2A), renvoie le plafond
 * salarial applicable et le taux. La 2ᵉ période (2B) est forfaitaire et ne passe
 * pas par ici (montant à vérifier, cf. calcChomage).
 */
function getPhaseParams(
  phase: PhaseProportionnelle,
  values: ChomageParams,
): { plafond: number; taux: number } {
  switch (phase) {
    case "1A":
      return { plafond: values.plafonds["1A"], taux: values.taux["1A"] };
    case "1B":
      // Plafond distinct mois 4-6 depuis la réforme 2026.
      return { plafond: values.plafonds["1B"], taux: values.taux.autres };
    case "2A":
      return { plafond: values.plafonds["2A"], taux: values.taux.autres };
  }
}

/**
 * Estime l'allocation de chômage complet selon ONEM (régime à partir du 01/03/2026).
 *
 * Renvoie une {@link ChomageEstimation} :
 *  - `estime` (1A/1B/2A) : montant mensuel chiffré, borné par les forfaits min/max ;
 *  - `forfait_a_verifier` (2B) : 2ᵉ période forfaitaire selon la catégorie familiale,
 *    montant non publié → aucun chiffre affiché, renvoyer à l'organisme de paiement ;
 *  - `error` : entrées invalides.
 *
 * La fin de droit (> 24 mois) est détectée par `phaseFromMonths` en amont : on
 * n'appelle pas `calcChomage` dans ce cas.
 */
export function calcChomage(input: ChomageInput): ChomageEstimation {
  const { salaireBrut, situationFamiliale, phase } = input;

  // --- Validation commune ---
  if (!(situationFamiliale in SITUATION_LABELS)) {
    return { error: "Situation familiale invalide." };
  }
  if (!(phase in PHASE_LABELS)) {
    return { error: "Phase de chômage invalide." };
  }

  // --- 2ᵉ période (mois 13-24) : forfait familial, montant à vérifier ---
  // Aucun barème chiffré (réforme 2026, barème ONEM en refonte) : on ne calcule
  // rien à partir du salaire — ce serait le modèle pré-réforme (erroné).
  if (phase === "2B") {
    return {
      statut: "forfait_a_verifier",
      situationLabel: SITUATION_LABELS[situationFamiliale],
      phaseLabel: PHASE_LABELS[phase],
    };
  }

  // --- 1ʳᵉ période (1A/1B/2A) : pourcentage du salaire plafonné ---
  if (!Number.isFinite(salaireBrut) || salaireBrut <= 100) {
    return {
      error: "Salaire brut invalide. Indiquez un montant mensuel réaliste (> 100 €).",
    };
  }

  const { values } = getChomageParams();
  const { plafond, taux } = getPhaseParams(phase, values);
  const salairePlafonne = Math.min(salaireBrut, plafond);

  // Montant brut, puis bornes forfaitaires min/max de la catégorie familiale.
  const min = values.forfaitMin[situationFamiliale];
  const max = values.forfaitMax[situationFamiliale];
  let allocationMensuelle = Math.min(Math.max(salairePlafonne * taux, min), max);

  // Arrondi 2 décimales pour rester cohérent avec les bulletins ONEM.
  allocationMensuelle = Math.round(allocationMensuelle * 100) / 100;

  // Régime 6 jours/semaine → ~26 jours indemnisables par mois.
  const allocationJournaliere =
    Math.round((allocationMensuelle / 26) * 100) / 100;

  return {
    statut: "estime",
    allocationMensuelle,
    allocationJournaliere,
    plafondApplique: plafond,
    salairePlafonne: Math.round(salairePlafonne * 100) / 100,
    tauxApplique: taux,
    situationLabel: SITUATION_LABELS[situationFamiliale],
    phaseLabel: PHASE_LABELS[phase],
  };
}
