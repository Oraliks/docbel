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

export type SituationFamiliale = "chef_menage" | "isole" | "cohabitant";

/**
 * Phases de dégressivité du chômage complet (ONEM).
 *  - 1A : mois 1-3   (taux maximal sur plafond A)
 *  - 1B : mois 4-6   (légère dégressivité sur plafond A)
 *  - 2A : mois 7-12  (plafond intermédiaire B)
 *  - 2B : mois 13-24 (plafond inférieur C)
 *  - 2C : an 2 → an 3 (forfaitaire dégressif intermédiaire)
 *  - 3  : au-delà (forfaitaire minimum)
 */
export type ChomagePhase = "1A" | "1B" | "2A" | "2B" | "2C" | "3";

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
/*  Barèmes 2026 (estimations indicatives basées sur ONEM 2025)       */
/* ------------------------------------------------------------------ */

/**
 * Plafonds salariaux mensuels (€) — barèmes ONEM au 1er mars 2026.
 * Source : onem.be — "À combien s'élève votre allocation de chômage".
 *
 * NB : la réforme 2026 a relevé les plafonds. La phase 4-6 a aussi son
 * propre plafond (PLAFOND_A_BIS) ; on l'utilise quand la phase est 1B.
 */
const PLAFOND_A = 4265.98; // mois 1-3 (phase 1A)
const PLAFOND_A_BIS = 4010.98; // mois 4-6 (phase 1B)
const PLAFOND_B = 3262.99; // mois 7-12 (phase 2A)
const PLAFOND_C = 3262.99; // mois 13+ (phase 2B) — aligné sur B après réforme 2026

/**
 * Forfaits MINIMUM mensuels par situation familiale (€).
 * En dessous, l'allocation calculée est remontée à ce plancher.
 */
const FORFAIT_MIN: Record<SituationFamiliale, number> = {
  chef_menage: 1500,
  isole: 1260,
  cohabitant: 1015,
};

/**
 * Forfaits MAXIMUM mensuels par situation familiale (€).
 * Au-dessus, l'allocation calculée est plafonnée à ce maximum.
 */
const FORFAIT_MAX: Record<SituationFamiliale, number> = {
  chef_menage: 2200,
  isole: 1850,
  cohabitant: 1500,
};

/**
 * Phase 2C — forfaitaire dégressif (an 2 → an 3 de chômage complet).
 */
const FORFAIT_2C: Record<SituationFamiliale, number> = {
  chef_menage: 1700,
  isole: 1400,
  cohabitant: 800,
};

/**
 * Phase 3 — forfaitaire minimal (au-delà d'an 3).
 * Égal au forfait minimum pour chef de ménage / isolé, plus bas pour cohabitant.
 */
const FORFAIT_3: Record<SituationFamiliale, number> = {
  chef_menage: 1500,
  isole: 1260,
  cohabitant: 670,
};

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

/* ------------------------------------------------------------------ */
/*  Calcul                                                            */
/* ------------------------------------------------------------------ */

/**
 * Pour une phase donnée, renvoie le plafond salarial applicable et le taux.
 * Les phases 2C et 3 sont forfaitaires : ces valeurs ne sont utilisées que
 * pour l'affichage (le calcul réel passe par FORFAIT_2C / FORFAIT_3).
 */
function getPhaseParams(phase: ChomagePhase): { plafond: number; taux: number } {
  switch (phase) {
    case "1A":
      return { plafond: PLAFOND_A, taux: 0.65 };
    case "1B":
      // Plafond distinct mois 4-6 depuis la réforme 2026.
      return { plafond: PLAFOND_A_BIS, taux: 0.6 };
    case "2A":
      return { plafond: PLAFOND_B, taux: 0.6 };
    case "2B":
      return { plafond: PLAFOND_C, taux: 0.6 };
    case "2C":
      // Forfaitaire — on conserve plafond C / taux 0.6 pour l'info affichée.
      return { plafond: PLAFOND_C, taux: 0.6 };
    case "3":
      return { plafond: PLAFOND_C, taux: 0.6 };
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

  const { plafond, taux } = getPhaseParams(phase);
  const salairePlafonne = Math.min(salaireBrut, plafond);

  // --- Montant brut avant bornes forfaitaires ---
  let allocationMensuelle: number;

  if (phase === "2C") {
    // Forfaitaire dégressif — indépendant du salaire.
    allocationMensuelle = FORFAIT_2C[situationFamiliale];
  } else if (phase === "3") {
    // Forfaitaire minimum.
    allocationMensuelle = FORFAIT_3[situationFamiliale];
  } else {
    // Phases 1A → 2B : pourcentage du salaire plafonné.
    allocationMensuelle = salairePlafonne * taux;
  }

  // --- Bornes forfaitaires min/max (toutes phases sauf forfaitaires pures) ---
  // Les forfaits 2C et 3 sont déjà calibrés ; on ne les re-borne pas.
  if (phase !== "2C" && phase !== "3") {
    const min = FORFAIT_MIN[situationFamiliale];
    const max = FORFAIT_MAX[situationFamiliale];
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
