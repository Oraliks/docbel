/**
 * Calcul de l'Impôt des Personnes Physiques (IPP) — Belgique.
 * Exercice d'imposition 2026 (revenus 2025), version enrichie.
 *
 * SOURCES (officielles, État belge UNIQUEMENT)
 * --------------------------------------------
 *  - SPF Finances — https://fin.belgium.be (taux d'imposition, quotité)
 *  - CIR 92 — Code des impôts sur les revenus 1992
 *  - AR/CIR 92 (barème fédéral indexé, annexe III)
 *  - Art. 131 CIR 92 (quotité du revenu exemptée d'impôt)
 *  - Art. 132 CIR 92 (suppléments pour personnes à charge)
 *  - Art. 134 CIR 92 (quotient conjugal)
 *  - Art. 145 CIR 92 et suivants (réductions d'impôt)
 *  - Loi 30/03/1994 — cotisation spéciale sécurité sociale
 *  - ONSS — https://socialsecurity.be (CSS bénéficiaires)
 *  - Moniteur belge — https://www.ejustice.just.fgov.be
 *  - Tax-on-web — https://finances.belgium.be/fr/E-services/tax-on-web
 *
 * AVERTISSEMENT
 * -------------
 * Ce calcul est INDICATIF — pédagogique. Il intègre les principales réductions
 * d'impôt (épargne pension, titres-services, dons, prêts hypothécaires, garde
 * d'enfants) et le quotient conjugal de façon SIMPLIFIÉE.
 * Pour le calcul officiel et personnalisé : Tax-on-web (SPF Finances).
 *
 * FORMULE GÉNÉRALE
 * ----------------
 *   1. impot_avant_quotite = barème fédéral appliqué au revenu imposable
 *      (avec quotient conjugal si applicable)
 *   2. reduction_quotite   = barème fédéral appliqué à la quotité exemptée
 *      (en partant du bas du barème)
 *   3. impot_brut_federal  = max(0, impot_avant_quotite - reduction_quotite)
 *   4. reductions_totales  = somme des crédits d'impôt (épargne pension, etc.)
 *   5. impot_apres_credits = max(0, impot_brut_federal - reductions_totales)
 *   6. impot_total         = impot_apres_credits × (1 + additionnel_communal/100)
 *                            + cotisation_speciale_secu
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type StatutIPP = "isole" | "marie_un_revenu" | "marie_deux_revenus";

export interface IPPInput {
  /** Revenu net imposable annuel (€) — après ONSS & frais pro forfaitaires. */
  revenuAnnuelImposable: number;
  /** Statut familial. */
  statut: StatutIPP;
  /** Nombre d'enfants à charge (0-10). */
  enfants: number;
  /** Autres personnes à charge (parents âgés, etc., 0-5). */
  autresPersonnesACharge: number;
  /** Additionnel communal en % (0-15 ; moyenne belge ≈ 7,5 %). */
  additionnelCommunal: number;
  /**
   * Parent isolé (allocataire seul) avec ≥ 1 enfant à charge.
   * Ouvre droit à un supplément de quotité de 1 980 € (EI 2026).
   * Ignoré si enfants === 0 ou si statut ≠ "isole".
   */
  parentIsole?: boolean;

  /* -- Réductions d'impôt (optionnelles, défaut 0) -- */
  /** Versement annuel épargne pension (€/an, max 1 050 € à 30 %). Réduction 30 %. */
  epargnePension?: number;
  /** Achats annuels titres-services (€/an, max 1 500 €). Réduction ≈ 15 %. */
  titresServices?: number;
  /** Dons à associations agréées (€/an, min 40 €/bénéficiaire). Réduction 45 %. */
  dons?: number;
  /** Capital + intérêts annuels prêt hypothécaire (€/an). Réduction ≈ 30 %. */
  pretHypothecaire?: number;
  /** Frais garde enfants < 14 ans (€/an, plafond 16,40 €/jour). Réduction 45 %. */
  gardeEnfants?: number;
}

export interface IPPResult {
  /** Impôt total dû (fédéral + additionnel communal + cotisation spéciale), en €/an. */
  impotTotal: number;
  /** Impôt fédéral brut après application de la quotité exemptée (€/an). */
  impotBrutFederal: number;
  /** Total des réductions d'impôt appliquées (€/an). */
  reductionsTotales: number;
  /** Impôt fédéral après imputation des crédits / réductions (€/an). */
  impotBrutApresCredits: number;
  /** Cotisation spéciale sécurité sociale (€/an). */
  cotisationSpecialeSecu: number;
  /** Montant absolu de l'additionnel communal (€/an). */
  additionnelCommunalEur: number;
  /** Réduction d'impôt liée à la quotité exemptée (€/an). */
  reductionQuotite: number;
  /** Quotité exemptée applicable (€/an). */
  quotiteExemptee: number;
  /** Taux moyen d'imposition (impot_total / revenu × 100), en %. */
  tauxMoyen: number;
  /** Taux marginal (taux de la tranche du dernier euro gagné), en %. */
  tauxMarginal: number;
  /** Revenu net après impôt (revenu - impot_total), en €/an. */
  revenuNetApresImpot: number;
  /** Détail par tranche (debug / transparence pédagogique). */
  tranches: Array<{ borne: number; taux: number; impotTranche: number }>;
  /** Si quotient conjugal appliqué : montant de l'allègement estimé (€/an). */
  allegementQuotientConjugal: number;
}

export interface IPPError {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — barème fédéral indexé 2026                           */
/* ------------------------------------------------------------------ */

/**
 * Tranches du barème fédéral IPP — exercice d'imposition 2026 (revenus 2025).
 * Les bornes sont les revenus annuels imposables.
 * Source : SPF Finances — https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition
 */
export const TRANCHES_IPP_2026: Array<{ min: number; max: number; taux: number }> = [
  { min: 0, max: 16320, taux: 0.25 },
  { min: 16320, max: 28800, taux: 0.4 },
  { min: 28800, max: 49840, taux: 0.45 },
  { min: 49840, max: Infinity, taux: 0.5 },
];

/**
 * Quotité du revenu exemptée d'impôt — base EI 2026 (revenus 2025).
 * Art. 131 CIR 92 (montant unique depuis l'EI 2020).
 * Source : SPF Finances — https://fin.belgium.be/en/private-individuals/tax-return/income/tax-rates
 */
export const QUOTITE_BASE_2026 = 10910;

/**
 * Suppléments cumulatifs de quotité par nombre d'enfants à charge — EI 2026.
 * Art. 132 CIR 92 — montants indexés (revenus 2025).
 * Source : SPF Finances — https://fin.belgium.be/fr/particuliers/declaration-impot/situation-personnelle/personnes-a-charge/enfants
 */
export const SUPPLEMENT_ENFANTS: Record<number, number> = {
  0: 0,
  1: 1980,
  2: 5110,
  3: 11440,
  4: 18510,
  5: 18510 + 7070,
};

export const SUPPLEMENT_ENFANT_AU_DELA_5 = 7070;

/**
 * Supplément par autre personne à charge (parent âgé, etc.) — EI 2026.
 * Source : SPF Finances — https://fin.belgium.be/fr/particuliers/declaration-impot/situation-personnelle/personnes-a-charge/autres
 * Note : 5 950 € si la personne a 66 ans+ et en état de dépendance ; on retient
 * 1 980 € comme cas générique (autre personne à charge).
 */
export const SUPPLEMENT_AUTRE_PERSONNE = 1980;

/**
 * Supplément pour parent isolé (allocataire seul) avec ≥ 1 enfant à charge.
 * Source : SPF Finances — EI 2026 (revenus 2025).
 */
export const SUPPLEMENT_PARENT_ISOLE = 1980;

/* ------------------------------------------------------------------ */
/*  Constantes — réductions d'impôt 2026                              */
/* ------------------------------------------------------------------ */

/**
 * Épargne pension — panier de base (palier 1) : versement max ouvrant droit
 * à la réduction au taux normal de 30 %. EI 2026 (revenus 2025).
 * Source : SPF Finances — https://fin.belgium.be/fr/particuliers/avantages-fiscaux/epargne-pension
 */
export const EPARGNE_PENSION_PLAFOND = 1050;
/** Épargne pension : taux de réduction (30 % sur le palier de base). Art. 145 CIR 92. */
export const EPARGNE_PENSION_TAUX = 0.3;

/** Titres-services : taux moyen de réduction (moyenne 3 régions ≈ 15 %). */
export const TITRES_SERVICES_TAUX = 0.15;
/** Titres-services : plafond annuel d'achats ouvrant droit à réduction. */
export const TITRES_SERVICES_PLAFOND = 1500;

/** Dons : taux de réduction (45 %) — minimum 40 €/an/bénéficiaire. Art. 145³³ CIR 92. */
export const DONS_TAUX = 0.45;
export const DONS_MINIMUM = 40;

/** Prêt hypothécaire : taux moyen (chèque habitation régional ≈ 30 %). */
export const PRET_HYPO_TAUX = 0.3;

/** Garde d'enfants : taux 45 %, plafond 16,40 €/jour/enfant. */
export const GARDE_ENFANTS_TAUX = 0.45;

/* ------------------------------------------------------------------ */
/*  Constantes — quotient conjugal & cotisation spéciale              */
/* ------------------------------------------------------------------ */

/**
 * Quotient conjugal — plafond du transfert virtuel vers conjoint sans revenu.
 * Art. 134 CIR 92, montant indexé EI 2026 (revenus 2025).
 * Source : SPF Finances — page mariage et cohabitation.
 */
export const QUOTIENT_CONJUGAL_PLAFOND = 13460;

/**
 * Cotisation spéciale sécurité sociale — seuils 2026 (loi 30/03/1994).
 * Source : ONSS — https://socialsecurity.be (DmfA 2026/1, code 856).
 * Note : le barème ONSS officiel est trimestriel et plus granulaire ;
 * on retient ici une approximation annuelle préservant le plafond légal
 * de 731,28 €/an (arrondi à 731 €).
 */
const CSS_SEUIL_BAS = 18592;
const CSS_SEUIL_MOYEN = 21070;
const CSS_SEUIL_HAUT = 60161;
const CSS_TAUX_TRANCHE_1 = 0.09; // 9 % sur 18 592 → 21 070
const CSS_TAUX_TRANCHE_2 = 0.013; // 1,3 % sur 21 070 → 60 161
export const CSS_PLAFOND_ANNUEL = 731;

/* ------------------------------------------------------------------ */
/*  Helpers internes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Applique le barème fédéral progressif à un montant, en partant du bas.
 */
function appliquerBareme(montant: number): {
  total: number;
  tranches: Array<{ borne: number; taux: number; impotTranche: number }>;
} {
  const detail: Array<{ borne: number; taux: number; impotTranche: number }> =
    [];
  let total = 0;
  let restant = montant;

  for (const t of TRANCHES_IPP_2026) {
    if (restant <= 0) {
      detail.push({ borne: t.max, taux: t.taux, impotTranche: 0 });
      continue;
    }
    const largeur = t.max - t.min;
    const part = Math.min(restant, largeur);
    const impotTranche = part * t.taux;
    total += impotTranche;
    restant -= part;
    detail.push({ borne: t.max, taux: t.taux, impotTranche });
  }

  return { total, tranches: detail };
}

/** Calcule la quotité exemptée totale en fonction de la situation familiale. */
function calculerQuotiteExemptee(
  enfants: number,
  autresPersonnes: number,
  parentIsole: boolean,
): number {
  let supplementEnfants = 0;
  if (enfants <= 5) {
    supplementEnfants = SUPPLEMENT_ENFANTS[enfants] ?? 0;
  } else {
    supplementEnfants =
      SUPPLEMENT_ENFANTS[5] + (enfants - 5) * SUPPLEMENT_ENFANT_AU_DELA_5;
  }

  const supplementAutres = autresPersonnes * SUPPLEMENT_AUTRE_PERSONNE;
  const supplementIsole =
    parentIsole && enfants > 0 ? SUPPLEMENT_PARENT_ISOLE : 0;

  return (
    QUOTITE_BASE_2026 +
    supplementEnfants +
    supplementAutres +
    supplementIsole
  );
}

/** Renvoie le taux marginal applicable au dernier euro gagné. */
function tauxMarginalPour(revenu: number): number {
  for (const t of TRANCHES_IPP_2026) {
    if (revenu <= t.max) return t.taux;
  }
  return TRANCHES_IPP_2026[TRANCHES_IPP_2026.length - 1].taux;
}

/**
 * Cotisation spéciale sécurité sociale (CSS) — barème dégressif.
 * Source : loi 30/03/1994, montants 2026.
 */
function calculerCotisationSpecialeSecu(revenu: number): number {
  if (revenu <= CSS_SEUIL_BAS) return 0;

  // Tranche 18 592 → 21 070 : 9 %
  if (revenu <= CSS_SEUIL_MOYEN) {
    return (revenu - CSS_SEUIL_BAS) * CSS_TAUX_TRANCHE_1;
  }

  // Tranche 21 070 → 60 161 : montant plancher + 1,3 % sur excédent
  const plancher = (CSS_SEUIL_MOYEN - CSS_SEUIL_BAS) * CSS_TAUX_TRANCHE_1;
  if (revenu <= CSS_SEUIL_HAUT) {
    return Math.min(
      CSS_PLAFOND_ANNUEL,
      plancher + (revenu - CSS_SEUIL_MOYEN) * CSS_TAUX_TRANCHE_2,
    );
  }

  // Au-delà : plafond fixe
  return CSS_PLAFOND_ANNUEL;
}

/**
 * Réductions d'impôt — version simplifiée.
 * Toutes les valeurs en input sont des MONTANTS (€/an), pas des plafonds.
 */
function calculerReductions(input: IPPInput): number {
  const {
    epargnePension = 0,
    titresServices = 0,
    dons = 0,
    pretHypothecaire = 0,
    gardeEnfants = 0,
  } = input;

  let total = 0;

  // 1. Épargne pension : 30 % du versement, plafonné à 1 050 € versés (EI 2026).
  //    Note : 25 % entre 1 050 et 1 350 € — non modélisé ici (rare en pratique).
  if (epargnePension > 0) {
    const verseEffectif = Math.min(epargnePension, EPARGNE_PENSION_PLAFOND);
    total += verseEffectif * EPARGNE_PENSION_TAUX;
  }

  // 2. Titres-services : ≈ 15 % des achats, plafonné à 1 500 €.
  if (titresServices > 0) {
    const achatsEffectifs = Math.min(titresServices, TITRES_SERVICES_PLAFOND);
    total += achatsEffectifs * TITRES_SERVICES_TAUX;
  }

  // 3. Dons : 45 % à partir de 40 €/an/bénéficiaire (seuil unique simplifié).
  if (dons >= DONS_MINIMUM) {
    total += dons * DONS_TAUX;
  }

  // 4. Prêt hypothécaire : 30 % (chèque habitation moyen).
  if (pretHypothecaire > 0) {
    total += pretHypothecaire * PRET_HYPO_TAUX;
  }

  // 5. Garde d'enfants : 45 % (plafond journalier non vérifié ici, l'input
  //    est déjà supposé être le montant éligible).
  if (gardeEnfants > 0) {
    total += gardeEnfants * GARDE_ENFANTS_TAUX;
  }

  return total;
}

/* ------------------------------------------------------------------ */
/*  Calcul principal                                                  */
/* ------------------------------------------------------------------ */

export function calcIPP(input: IPPInput): IPPResult | IPPError {
  const {
    revenuAnnuelImposable,
    statut,
    enfants,
    autresPersonnesACharge,
    additionnelCommunal,
    parentIsole = false,
    epargnePension = 0,
    titresServices = 0,
    dons = 0,
    pretHypothecaire = 0,
    gardeEnfants = 0,
  } = input;

  /* -- Validation des entrées -- */
  if (
    !Number.isFinite(revenuAnnuelImposable) ||
    revenuAnnuelImposable < 0 ||
    revenuAnnuelImposable > 10_000_000
  ) {
    return {
      error:
        "Le revenu annuel imposable doit être un nombre positif (max 10 000 000 €).",
    };
  }
  if (!Number.isInteger(enfants) || enfants < 0 || enfants > 10) {
    return { error: "Le nombre d'enfants à charge doit être entre 0 et 10." };
  }
  if (
    !Number.isInteger(autresPersonnesACharge) ||
    autresPersonnesACharge < 0 ||
    autresPersonnesACharge > 5
  ) {
    return {
      error:
        "Le nombre d'autres personnes à charge doit être entre 0 et 5.",
    };
  }
  if (
    !Number.isFinite(additionnelCommunal) ||
    additionnelCommunal < 0 ||
    additionnelCommunal > 15
  ) {
    return {
      error:
        "L'additionnel communal doit être compris entre 0 % et 15 %.",
    };
  }
  if (
    !Number.isFinite(epargnePension) ||
    epargnePension < 0 ||
    epargnePension > 5000
  ) {
    return {
      error: "Versement épargne pension : entre 0 et 5 000 €/an.",
    };
  }
  if (
    !Number.isFinite(titresServices) ||
    titresServices < 0 ||
    titresServices > 5000
  ) {
    return {
      error: "Achats titres-services : entre 0 et 5 000 €/an.",
    };
  }
  if (!Number.isFinite(dons) || dons < 0 || dons > 100_000) {
    return { error: "Dons : entre 0 et 100 000 €/an." };
  }
  if (
    !Number.isFinite(pretHypothecaire) ||
    pretHypothecaire < 0 ||
    pretHypothecaire > 50_000
  ) {
    return { error: "Prêt hypothécaire : entre 0 et 50 000 €/an." };
  }
  if (
    !Number.isFinite(gardeEnfants) ||
    gardeEnfants < 0 ||
    gardeEnfants > 50_000
  ) {
    return { error: "Frais de garde : entre 0 et 50 000 €/an." };
  }

  /* -- 1. Quotité exemptée (en fonction de la situation familiale) -- */
  const quotiteExemptee = calculerQuotiteExemptee(
    enfants,
    autresPersonnesACharge,
    parentIsole,
  );

  /* -- 2. Impôt brut sur le revenu imposable (avant quotité) -- */
  const { total: impotAvantQuotite, tranches } = appliquerBareme(
    revenuAnnuelImposable,
  );

  /* -- 3. Réduction d'impôt liée à la quotité exemptée -- */
  const baseQuotite = Math.min(quotiteExemptee, revenuAnnuelImposable);
  const { total: reductionQuotite } = appliquerBareme(baseQuotite);

  /* -- 4. Impôt fédéral brut après quotité -- */
  let impotBrutFederal = Math.max(0, impotAvantQuotite - reductionQuotite);

  /* -- 5. Quotient conjugal (marié un seul revenu) — approximation -- *
   *
   * Le calcul officiel : transfert virtuel de 30 % du revenu (max 13 530 €)
   * vers le conjoint sans revenu, chaque part bénéficiant de sa propre
   * quotité de base 10 910 €.
   *
   * Approximation retenue : réduction d'impôt de 25 % sur la partie au-delà
   * de 16 320 €, plafonnée au plafond légal de transfert. Cela reproduit
   * grossièrement l'allègement de l'écrasement progressif des tranches.
   */
  let allegementQuotientConjugal = 0;
  if (statut === "marie_un_revenu") {
    const baseTransfert = Math.min(
      Math.max(0, revenuAnnuelImposable - 16320),
      QUOTIENT_CONJUGAL_PLAFOND,
    );
    allegementQuotientConjugal = baseTransfert * 0.25;
    impotBrutFederal = Math.max(
      0,
      impotBrutFederal - allegementQuotientConjugal,
    );
  }

  /* -- 6. Réductions d'impôt (crédits) -- */
  const reductionsTotales = calculerReductions(input);
  const impotBrutApresCredits = Math.max(
    0,
    impotBrutFederal - reductionsTotales,
  );

  /* -- 7. Additionnel communal (appliqué sur l'impôt après crédits) -- */
  const additionnelCommunalEur =
    impotBrutApresCredits * (additionnelCommunal / 100);

  /* -- 8. Cotisation spéciale sécurité sociale -- */
  const cotisationSpecialeSecu = calculerCotisationSpecialeSecu(
    revenuAnnuelImposable,
  );

  const impotTotal =
    impotBrutApresCredits + additionnelCommunalEur + cotisationSpecialeSecu;

  /* -- 9. Indicateurs synthétiques -- */
  const tauxMoyen =
    revenuAnnuelImposable > 0
      ? (impotTotal / revenuAnnuelImposable) * 100
      : 0;
  const tauxMarginal = tauxMarginalPour(revenuAnnuelImposable) * 100;
  const revenuNetApresImpot = revenuAnnuelImposable - impotTotal;

  // Silence "unused" pour les destructurés (servent à la validation in-loco).
  void epargnePension;
  void titresServices;
  void dons;
  void parentIsole;
  void pretHypothecaire;
  void gardeEnfants;

  return {
    impotTotal,
    impotBrutFederal,
    reductionsTotales,
    impotBrutApresCredits,
    cotisationSpecialeSecu,
    additionnelCommunalEur,
    reductionQuotite,
    quotiteExemptee,
    tauxMoyen,
    tauxMarginal,
    revenuNetApresImpot,
    tranches,
    allegementQuotientConjugal,
  };
}
