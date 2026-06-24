/**
 * Simulateur rapide d'allocation de chômage — 1ʳᵉ période d'indemnisation.
 *
 * Moteur PUR (zéro import React) pensé pour la carte « Mon estimation » du
 * hero : trois entrées (catégorie familiale, salaire brut, ancienneté de
 * chômage en mois), une sortie honnête avec ses limites (`caveats`).
 *
 * ⚠️ ARCHITECTURE — pas de barème dupliqué ici :
 *   le repo possède DÉJÀ un moteur d'allocations ONEM complet,
 *   `lib/calculators/chomage.ts` (plafonds salariaux par phase, taux 65/60 %,
 *   forfaits min/max par catégorie, dégressivité 1A → 3), utilisé par le
 *   calculateur public de /outils. Ce fichier est un ADAPTATEUR au-dessus de
 *   `calcChomage` : mêmes chiffres garantis entre la carte du hero et le
 *   calculateur complet (deux montants différents pour la même situation
 *   ruineraient la confiance). Les montants réglementaires (plafonds,
 *   planchers, taux) vivent donc UNIQUEMENT dans lib/calculators/chomage.ts.
 *
 * Périmètre assumé : la 1ʳᵉ période d'indemnisation (12 premiers mois),
 * découpée comme le moteur sous-jacent — 65 % du salaire plafonné les
 * 3 premiers mois, puis 60 % avec un plafond salarial qui diminue par palier.
 * Au-delà de 12 mois : hors périmètre (cf. `caveats`), on renvoie la fin de
 * 1ʳᵉ période plutôt que de bloquer (principe « informatif, jamais bloquant »).
 */

import {
  calcChomage,
  type ChomagePhase,
  type SituationFamiliale,
} from "@/lib/calculators/chomage";

/* ------------------------------------------------------------------ */
/*  Constantes du simulateur                                           */
/* ------------------------------------------------------------------ */

/**
 * Bornes de période + conventions du simulateur (année 2026).
 *
 * Les montants en euros (plafonds salariaux, forfaits min/max) ne sont PAS
 * ici : ils sont centralisés dans `lib/calculators/chomage.ts` (source ONEM
 * documentée sur place) et consommés via `calcChomage`.
 */
export const BAREME_2026 = {
  /**
   * Dernier mois (inclus) indemnisé à 65 % du salaire plafonné.
   * Source : ONEM, « À combien s'élève votre allocation de chômage » —
   * cf. PHASES_INFO de lib/calculators/chomage.ts (phase 1A = mois 1-3).
   * CHIFFRE INDICATIF — À VALIDER PAR L'EXPERT (Oraliks) avant toute
   * communication.
   */
  dernierMoisTaux65: 3,
  /**
   * Dernier mois (inclus) du plafond salarial intermédiaire (phase 1B,
   * mois 4-6, taux 60 %). Source : ONEM, idem ci-dessus (réforme 2026 :
   * plafond distinct pour les mois 4-6).
   * CHIFFRE INDICATIF — À VALIDER PAR L'EXPERT (Oraliks) avant toute
   * communication.
   */
  dernierMoisPlafondIntermediaire: 6,
  /**
   * Fin de la 1ʳᵉ période d'indemnisation couverte par ce simulateur
   * (en mois). Au-delà : dégressivité 2ᵉ/3ᵉ périodes, non simulée ici —
   * renvoyer vers le calculateur complet de /outils.
   * CHIFFRE INDICATIF — À VALIDER PAR L'EXPERT (Oraliks) avant toute
   * communication.
   */
  finPremierePeriode: 12,
  /**
   * Jours indemnisables par mois en régime 6 jours/semaine (convention
   * ONEM utilisée par calcChomage : allocation mensuelle = journalière × 26).
   * CHIFFRE INDICATIF — À VALIDER PAR L'EXPERT (Oraliks) avant toute
   * communication.
   */
  joursIndemnisablesParMois: 26,
  /**
   * Salaire brut mensuel minimal (exclu) accepté par le moteur sous-jacent :
   * en dessous, l'estimation est refusée (saisie probablement erronée, ex.
   * salaire horaire ou journalier). Aligné sur la garde de calcChomage.
   * CHIFFRE INDICATIF — À VALIDER PAR L'EXPERT (Oraliks) avant toute
   * communication.
   */
  brutMensuelMinimum: 100,
} as const;

/* ------------------------------------------------------------------ */
/*  Types & libellés                                                   */
/* ------------------------------------------------------------------ */

/** Catégories familiales ONEM — réutilise le type du moteur central. */
export type CategorieFamiliale = SituationFamiliale; // "chef_menage" | "isole" | "cohabitant"

export interface SimulationInput {
  categorie: CategorieFamiliale;
  /** Dernier salaire mensuel brut (€). */
  brutMensuel: number;
  /** Mois de chômage courant (1-based ; 0 toléré = tout début). */
  moisDeChomage: number;
}

export interface SimulationResult {
  /** Allocation journalière estimée (€, 2 décimales). */
  parJour: number;
  /**
   * Allocation mensuelle estimée (€). Chiffre mensuel du moteur central
   * (≈ parJour × 26 ; l'écart d'arrondi éventuel est de quelques centimes,
   * on garde le mensuel « officiel » pour rester identique à /outils).
   */
  parMois: number;
  /** Taux appliqué au salaire plafonné (65 ou 60). */
  tauxPct: number;
  /**
   * true si un plafonnement a réduit le montant : plafond salarial de la
   * période OU forfait maximum de la catégorie familiale.
   */
  plafondApplique: boolean;
  /** Libellé humain de la sous-période, ex. « 1ʳᵉ période · mois 4-6 ». */
  periodeLabel: string;
  /** Limites honnêtes de l'estimation, à afficher ou logger telles quelles. */
  caveats: string[];
}

/** Libellés FR des catégories (ordre d'affichage du formulaire).
 *  Fallback si la clé i18n CATEGORIE_LABEL_KEYS n'est pas résolue. */
export const CATEGORIE_LABELS: Record<CategorieFamiliale, string> = {
  isole: "Isolé",
  cohabitant: "Cohabitant",
  chef_menage: "Chef de ménage",
};

/** Clés i18n des catégories familiales (namespace `public.dossierContent`). */
export const CATEGORIE_LABEL_KEYS: Record<CategorieFamiliale, string> = {
  isole: "sim.categorie.isole",
  cohabitant: "sim.categorie.cohabitant",
  chef_menage: "sim.categorie.chefMenage",
};

export type AncienneteValue = "0-3" | "4-12";

/**
 * Options d'ancienneté proposées par la carte du hero. `moisRepresentatif`
 * est le mois envoyé au moteur : pour « 4-12 mois » on prend le début de
 * tranche (le plus favorable) — le caveat « dès le 7ᵉ mois » prévient les
 * salaires au-dessus du plafond suivant.
 */
export const ANCIENNETE_OPTIONS: {
  value: AncienneteValue;
  label: string;
  labelKey: string;
  moisRepresentatif: number;
}[] = [
  { value: "0-3", label: "0 à 3 mois", labelKey: "sim.anciennete.0-3", moisRepresentatif: 1 },
  { value: "4-12", label: "4 à 12 mois", labelKey: "sim.anciennete.4-12", moisRepresentatif: 4 },
];

/** Sous-périodes couvertes (mapping vers les phases du moteur central). */
const PERIODE_LABELS: Record<Extract<ChomagePhase, "1A" | "1B" | "2A">, string> = {
  "1A": "1ʳᵉ période · mois 1-3",
  "1B": "1ʳᵉ période · mois 4-6",
  "2A": "1ʳᵉ période · mois 7-12",
};

/** Clés i18n des libellés de période (préférées si fournies, alignées sur PERIODE_LABELS). */
export const PERIODE_LABEL_KEYS: Record<Extract<ChomagePhase, "1A" | "1B" | "2A">, string> = {
  "1A": "sim.periode.1A",
  "1B": "sim.periode.1B",
  "2A": "sim.periode.2A",
};

/** Format € lisible pour les caveats (ex. « 3 262,99 € »). */
const EUR = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ------------------------------------------------------------------ */
/*  Estimation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Estime l'allocation de chômage (1ʳᵉ période) pour la carte du hero.
 *
 * Politique d'entrées aberrantes (documentée, testée) :
 *  - salaire non fini, négatif ou ≤ 100 € → THROW RangeError : remonter
 *    silencieusement au plancher cacherait une saisie erronée (ex. salaire
 *    horaire) et afficherait un montant trompeur ;
 *  - mois non fini ou négatif → THROW RangeError (bug d'appel) ;
 *  - mois > 12 → CLAMP à 12 + caveat : c'est une vraie situation utilisateur,
 *    on informe au lieu de bloquer (le montant exact relève du calculateur
 *    complet, dégressivité oblige).
 */
export function estimerAllocation(input: SimulationInput): SimulationResult {
  const { categorie, brutMensuel, moisDeChomage } = input;

  if (!(categorie in CATEGORIE_LABELS)) {
    throw new RangeError(`Catégorie familiale inconnue : ${String(categorie)}.`);
  }
  if (!Number.isFinite(brutMensuel) || brutMensuel < 0) {
    throw new RangeError(
      "Salaire brut mensuel invalide : indiquez un montant en euros positif.",
    );
  }
  if (brutMensuel <= BAREME_2026.brutMensuelMinimum) {
    throw new RangeError(
      `Salaire brut mensuel trop bas pour une estimation fiable (plus de ${BAREME_2026.brutMensuelMinimum} € attendus).`,
    );
  }
  if (!Number.isFinite(moisDeChomage) || moisDeChomage < 0) {
    throw new RangeError(
      "Ancienneté de chômage invalide : indiquez un nombre de mois positif.",
    );
  }

  const horsPeriode = moisDeChomage > BAREME_2026.finPremierePeriode;
  const mois = Math.floor(
    Math.min(moisDeChomage, BAREME_2026.finPremierePeriode),
  );

  const phase: Extract<ChomagePhase, "1A" | "1B" | "2A"> =
    mois <= BAREME_2026.dernierMoisTaux65
      ? "1A"
      : mois <= BAREME_2026.dernierMoisPlafondIntermediaire
        ? "1B"
        : "2A";

  const res = calcChomage({
    salaireBrut: brutMensuel,
    situationFamiliale: categorie,
    phase,
  });
  if ("error" in res) {
    // Défensif : les gardes ci-dessus couvrent déjà les cas d'erreur connus.
    throw new RangeError(res.error);
  }

  // Le moteur central borne le montant en silence ; on re-dérive ici QUEL
  // mécanisme a joué pour pouvoir l'expliquer (± 1 centime d'arrondi).
  const avantBornes = res.salairePlafonne * res.tauxApplique;
  const plafondSalarial = brutMensuel > res.plafondApplique;
  const forfaitMax = res.allocationMensuelle < avantBornes - 0.01;
  const plancher = res.allocationMensuelle > avantBornes + 0.01;

  const caveats: string[] = [];
  if (plafondSalarial) {
    caveats.push(
      `Salaire pris en compte plafonné à ${EUR.format(res.plafondApplique)} € (plafond de la période).`,
    );
  }
  if (plancher) {
    caveats.push(
      "Montant relevé au forfait minimum de votre catégorie familiale.",
    );
  }
  if (forfaitMax) {
    caveats.push(
      "Montant limité au forfait maximum de votre catégorie familiale.",
    );
  }
  if (phase === "1B") {
    // Dès le 7ᵉ mois le plafond salarial diminue : prévenir uniquement si
    // cela changera réellement le montant (hauts salaires).
    const suite = calcChomage({
      salaireBrut: brutMensuel,
      situationFamiliale: categorie,
      phase: "2A",
    });
    if (
      !("error" in suite) &&
      suite.allocationJournaliere < res.allocationJournaliere
    ) {
      caveats.push(
        "Dès le 7ᵉ mois de chômage, le plafond salarial diminue : cette estimation baissera.",
      );
    }
  }
  if (horsPeriode) {
    caveats.push(
      "Au-delà de 12 mois, la dégressivité (2ᵉ et 3ᵉ périodes) s'applique : montant probablement surestimé, utilisez le calculateur complet.",
    );
  }
  caveats.push(
    "Estimation indicative, hors dégressivité des 2ᵉ et 3ᵉ périodes d'indemnisation.",
    "Montants bruts ; seule la décision de l'ONEM fait foi.",
  );

  return {
    parJour: res.allocationJournaliere,
    parMois: res.allocationMensuelle,
    tauxPct: Math.round(res.tauxApplique * 100),
    plafondApplique: plafondSalarial || forfaitMax,
    periodeLabel: PERIODE_LABELS[phase],
    caveats,
  };
}
