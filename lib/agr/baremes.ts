/**
 * Barèmes AGR par période. Valeurs extraites de l'Excel FGTB
 * « Calcul AGR 01042026.xlsm » (feuilles `calcul 0104xx`, colonnes AH/AI, et
 * `Montants base PP 2026`).
 *
 * ⚠️ Les barèmes changent à chaque indexation : ajouter une nouvelle période
 * = ajouter une entrée ici (les formules, elles, ne changent pas).
 */

/** Paramètres du précompte professionnel (feuille « Montants base PP »). */
export interface PrecompteParams {
  /** Plafond de revenus pour les frais forfaitaires (C42). */
  forfaitPlafond: number;
  /** Montant max des frais forfaitaires (C43). */
  forfaitMax: number;
  /** Pourcentage des frais forfaitaires (C44). */
  forfaitPct: number;
  /** Plafonds de revenus des tranches (C45/C46/C47). */
  plafond1: number;
  plafond2: number;
  plafond3: number;
  /** Pourcentages d'imposition par tranche (C48/C49/C50/C51). */
  pct1: number;
  pct2: number;
  pct3: number;
  pct4: number;
  /** Montants fixes ajoutés au-delà de chaque plafond (C52/C53/C54). */
  fixe1: number;
  fixe2: number;
  fixe3: number;
  /** Diminution d'impôt de base (C55). */
  diminutionBase: number;
  /** Montant max d'indemnité attribuée au conjoint (C56). */
  maxIndemniteConjoint: number;
}

/** Paramètres des tranches du bonus à l'emploi (colonnes AI). */
export interface BonusParams {
  /** Bonus maximal (AI7). */
  base: number;
  /** Début de la 1ʳᵉ dégressivité (AI11) et sa borne stricte (AI8 = +0,01). */
  seuil1: number;
  seuil1Ex: number;
  /** Pente de la 1ʳᵉ dégressivité (AI9). */
  pente1: number;
  /** Début de la 2ᵉ dégressivité (AI15) et borne (AI14 = +0,01). */
  seuil2: number;
  seuil2Ex: number;
  /** Base de la 2ᵉ dégressivité (AI16). */
  base2: number;
  /** Pente de la 2ᵉ dégressivité (AI17). */
  pente2: number;
  /** Fin du bonus (AI12) et borne (AI13 = +0,01). */
  seuil3: number;
  seuil3Ex: number;
}

export interface Bareme {
  /** Libellé de la période. */
  libelle: string;
  /** Salaire mensuel de référence AGR (AH28). */
  salaireReference: number;
  /** Demi-allocation minimale AGR (AH6). */
  demiAllocationMin: number;
  /** Supplément AGR par jour selon catégorie familiale (AI19/AI21/AI22) → F3. */
  supplementJour: { A: number; N: number; B: number };
  /** Supplément horaire AGR (AI24/AI25/AI27) → F4. */
  supplementHoraire: { A: number; N: number; B: number };
  /** Tranches du bonus à l'emploi. */
  bonus: BonusParams;
  /** Paramètres du précompte professionnel. */
  precompte: PrecompteParams;
}

/** Coefficient salaire imposable (× 0,8693) — constant dans le classeur. */
export const COEF_IMPOSABLE = 0.8693;
/** Coefficient brut (100 / 89,91) : neutralise le précompte AGR de 10,09 %. */
export const COEF_BRUT = 100 / 89.91;
/** Facteur B1 sur l'allocation journalière (× 0,8991). */
export const COEF_B1 = 0.8991;
/** Facteur de mensualisation (S × 4,3333). */
export const FACTEUR_MENSUEL = 4.3333;

/** Barème « valable à partir d'avril 2026 » (feuille `calcul 010426`). */
const BAREME_010426: Bareme = {
  libelle: "À partir d'avril 2026",
  salaireReference: 2189.81,
  demiAllocationMin: 14.64,
  supplementJour: { A: 9.35, N: 7.48, B: 5.61 },
  supplementHoraire: { A: 4.1, N: 4.1, B: 4.1 },
  bonus: {
    base: 293.66,
    seuil1: 2255.5,
    seuil1Ex: 2255.51,
    pente1: 0.2699,
    seuil2: 2880.32,
    seuil2Ex: 2880.33,
    base2: 125.04,
    pente2: 0.2738,
    seuil3: 3336.98,
    seuil3Ex: 3336.99,
  },
  precompte: {
    forfaitPlafond: 20233.33,
    forfaitMax: 6070,
    forfaitPct: 30,
    plafond1: 16710,
    plafond2: 29500,
    plafond3: 51050,
    pct1: 26.75,
    pct2: 42.8,
    pct3: 48.15,
    pct4: 53.5,
    fixe1: 4469.93,
    fixe2: 9944.05,
    fixe3: 20320.38,
    diminutionBase: 2987.98,
    maxIndemniteConjoint: 13790,
  },
};

/** Registre des barèmes disponibles, par clé de période. */
export const BAREMES: Record<string, Bareme> = {
  "010426": BAREME_010426,
};

/** Clé du barème le plus récent (par défaut). */
export const BAREME_DEFAUT = "010426";

export function getBareme(cle: string): Bareme {
  return BAREMES[cle] ?? BAREMES[BAREME_DEFAUT];
}
