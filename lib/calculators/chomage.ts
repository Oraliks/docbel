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
  "2C": "Année 2-3 (2C)",
  "3": "Après 3 ans (3)",
};

/**
 * Métadonnées des phases — pour usage dans l'UI (selects, infobulles).
 */
export const PHASES_INFO: {
  id: ChomagePhase;
  label: string;
  periode_description: string;
}[] = [
  { id: "1A", label: "Mois 1-3", periode_description: "65 % du salaire (plafond A)" },
  { id: "1B", label: "Mois 4-6", periode_description: "60 % du salaire (plafond A)" },
  { id: "2A", label: "Mois 7-12", periode_description: "60 % du salaire (plafond B)" },
  { id: "2B", label: "Mois 13-24", periode_description: "60 % du salaire (plafond C)" },
  { id: "2C", label: "Année 2-3", periode_description: "Forfaitaire dégressif" },
  { id: "3", label: "Après 3 ans", periode_description: "Forfaitaire minimum" },
];

/**
 * Déduit la phase de dégressivité à partir de l'ancienneté de chômage (en
 * mois). Source de vérité UNIQUE de la correspondance mois → phase, partagée
 * par le calculateur complet et le simulateur du hero (qui ne couvre que la
 * 1ʳᵉ période). Bornes ONEM : 1A (mois 1-3), 1B (4-6), 2A (7-12), 2B (13-24),
 * 2C (25-36), 3 (au-delà). Un mois ≤ 0 ou non fini est traité comme le mois 1.
 */
export function phaseFromMonths(mois: number): ChomagePhase {
  const m = Number.isFinite(mois) ? Math.max(1, Math.floor(mois)) : 1;
  if (m <= 3) return "1A";
  if (m <= 6) return "1B";
  if (m <= 12) return "2A";
  if (m <= 24) return "2B";
  if (m <= 36) return "2C";
  return "3";
}

/* ------------------------------------------------------------------ */
/*  Calcul                                                            */
/* ------------------------------------------------------------------ */

/**
 * Pour une phase donnée, renvoie le plafond salarial applicable et le taux.
 * Les phases 2C et 3 sont forfaitaires : ces valeurs ne sont utilisées que
 * pour l'affichage (le calcul réel passe par forfait2C / forfait3).
 */
function getPhaseParams(
  phase: ChomagePhase,
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
    case "2B":
      return { plafond: values.plafonds["2B"], taux: values.taux.autres };
    case "2C":
      // Forfaitaire — on conserve plafond C / taux 60 % pour l'info affichée.
      return { plafond: values.plafonds["2B"], taux: values.taux.autres };
    case "3":
      return { plafond: values.plafonds["2B"], taux: values.taux.autres };
  }
}

/**
 * Calcule l'allocation de chômage mensuelle estimée selon ONEM.
 *
 * Retourne soit un `ChomageResult`, soit `{ error }` si les entrées sont
 * invalides (salaire trop bas, phase/statut incohérents).
 */
export function calcChomage(
  input: ChomageInput,
): ChomageResult | { error: string } {
  const { salaireBrut, situationFamiliale, phase } = input;

  // --- Validation ---
  if (!Number.isFinite(salaireBrut) || salaireBrut <= 100) {
    return {
      error: "Salaire brut invalide. Indiquez un montant mensuel réaliste (> 100 €).",
    };
  }
  if (!(situationFamiliale in SITUATION_LABELS)) {
    return { error: "Situation familiale invalide." };
  }
  if (!(phase in PHASE_LABELS)) {
    return { error: "Phase de chômage invalide." };
  }

  const { values } = getChomageParams();
  const { plafond, taux } = getPhaseParams(phase, values);
  const salairePlafonne = Math.min(salaireBrut, plafond);

  // --- Montant brut avant bornes forfaitaires ---
  let allocationMensuelle: number;

  if (phase === "2C") {
    // Forfaitaire dégressif — indépendant du salaire.
    allocationMensuelle = values.forfait2C[situationFamiliale];
  } else if (phase === "3") {
    // Forfaitaire minimum.
    allocationMensuelle = values.forfait3[situationFamiliale];
  } else {
    // Phases 1A → 2B : pourcentage du salaire plafonné.
    allocationMensuelle = salairePlafonne * taux;
  }

  // --- Bornes forfaitaires min/max (toutes phases sauf forfaitaires pures) ---
  // Les forfaits 2C et 3 sont déjà calibrés ; on ne les re-borne pas.
  if (phase !== "2C" && phase !== "3") {
    const min = values.forfaitMin[situationFamiliale];
    const max = values.forfaitMax[situationFamiliale];
    allocationMensuelle = Math.min(Math.max(allocationMensuelle, min), max);
  }

  // Arrondi 2 décimales pour rester cohérent avec les bulletins ONEM.
  allocationMensuelle = Math.round(allocationMensuelle * 100) / 100;

  // Régime 6 jours/semaine → ~26 jours indemnisables par mois.
  const allocationJournaliere =
    Math.round((allocationMensuelle / 26) * 100) / 100;

  return {
    allocationMensuelle,
    allocationJournaliere,
    plafondApplique: plafond,
    salairePlafonne: Math.round(salairePlafonne * 100) / 100,
    tauxApplique: taux,
    situationLabel: SITUATION_LABELS[situationFamiliale],
    phaseLabel: PHASE_LABELS[phase],
  };
}
