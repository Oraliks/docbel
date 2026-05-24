/**
 * Calcul de l'Impôt des Personnes Physiques (IPP) — Belgique.
 * Exercice d'imposition 2026 (revenus 2025), version simplifiée.
 *
 * SOURCES
 * -------
 *  - SPF Finances — finances.belgium.be
 *  - Code des impôts sur les revenus 1992 (CIR 92)
 *  - Barème fédéral indexé 2026 (AR/CIR 92, annexe III)
 *  - Art. 131 CIR 92 (quotité du revenu exemptée d'impôt)
 *  - Art. 132 CIR 92 (suppléments pour personnes à charge)
 *
 * AVERTISSEMENT
 * -------------
 * Ce calcul est INDICATIF — pédagogique uniquement. Le calcul officiel
 * intègre de nombreux crédits, réductions et dépenses déductibles non
 * simulés ici (épargne pension, titres-services, dons, prêts hypothécaires,
 * pensions alimentaires versées, libéralités, garde d'enfants, etc.).
 *
 * Pour le calcul officiel et personnalisé : Tax-on-web (SPF Finances).
 *
 * FORMULE GÉNÉRALE
 * ----------------
 *   1. impot_avant_quotite = barème fédéral appliqué au revenu imposable
 *   2. reduction_quotite   = barème fédéral appliqué à la quotité exemptée
 *      (en partant du bas du barème : la quotité "consomme" d'abord la
 *       tranche à 25 %, puis la 40 %, etc.)
 *   3. impot_brut          = max(0, impot_avant_quotite - reduction_quotite)
 *   4. impot_total         = impot_brut × (1 + additionnel_communal / 100)
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
}

export interface IPPResult {
  /** Impôt total dû (fédéral + additionnel communal), en €/an. */
  impotTotal: number;
  /** Impôt fédéral brut après application de la quotité exemptée (€/an). */
  impotBrutFederal: number;
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
 * Source : SPF Finances / Wikifin (montant indexé 2026).
 */
const QUOTITE_BASE_2026 = 10910;

/**
 * Suppléments cumulatifs de quotité par nombre d'enfants à charge.
 * Art. 132 CIR 92 — montants indexés 2026.
 *
 * Cumulatif (non linéaire) : pour n enfants, on prend SUPPLEMENT_ENFANTS[n].
 * Au-delà de 5, on ajoute 6 840 € par enfant supplémentaire.
 */
const SUPPLEMENT_ENFANTS: Record<number, number> = {
  0: 0,
  1: 1920,
  2: 4950,
  3: 11080,
  4: 17920,
  5: 17920 + 6840,
};

const SUPPLEMENT_ENFANT_AU_DELA_5 = 6840;

/** Supplément par autre personne à charge (parent âgé, etc.). */
const SUPPLEMENT_AUTRE_PERSONNE = 1920;

/* ------------------------------------------------------------------ */
/*  Helpers internes                                                  */
/* ------------------------------------------------------------------ */

/**
 * Applique le barème fédéral progressif à un montant, en partant du bas.
 * Retourne le total d'impôt + le détail par tranche.
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
): number {
  let supplementEnfants = 0;
  if (enfants <= 5) {
    supplementEnfants = SUPPLEMENT_ENFANTS[enfants] ?? 0;
  } else {
    supplementEnfants =
      SUPPLEMENT_ENFANTS[5] + (enfants - 5) * SUPPLEMENT_ENFANT_AU_DELA_5;
  }

  const supplementAutres = autresPersonnes * SUPPLEMENT_AUTRE_PERSONNE;

  return QUOTITE_BASE_2026 + supplementEnfants + supplementAutres;
}

/** Renvoie le taux marginal applicable au dernier euro gagné. */
function tauxMarginalPour(revenu: number): number {
  for (const t of TRANCHES_IPP_2026) {
    if (revenu <= t.max) return t.taux;
  }
  return TRANCHES_IPP_2026[TRANCHES_IPP_2026.length - 1].taux;
}

/* ------------------------------------------------------------------ */
/*  Calcul principal                                                  */
/* ------------------------------------------------------------------ */

export function calcIPP(input: IPPInput): IPPResult | IPPError {
  const {
    revenuAnnuelImposable,
    enfants,
    autresPersonnesACharge,
    additionnelCommunal,
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

  /* -- 1. Quotité exemptée (en fonction de la situation familiale) -- */
  const quotiteExemptee = calculerQuotiteExemptee(
    enfants,
    autresPersonnesACharge,
  );

  /* -- 2. Impôt brut sur le revenu imposable (avant quotité) -- */
  const { total: impotAvantQuotite, tranches } = appliquerBareme(
    revenuAnnuelImposable,
  );

  /* -- 3. Réduction d'impôt liée à la quotité exemptée --
   *
   * La quotité exemptée n'est PAS une déduction du revenu : elle génère une
   * réduction d'impôt égale à ce que serait l'impôt sur ce montant, calculé
   * en partant du bas du barème (tranche 25 %, puis 40 %, etc.).
   *
   * On plafonne au revenu imposable pour ne pas créer de réduction sur des
   * tranches "vides" lorsque la quotité dépasse le revenu.
   */
  const baseQuotite = Math.min(quotiteExemptee, revenuAnnuelImposable);
  const { total: reductionQuotite } = appliquerBareme(baseQuotite);

  /* -- 4. Impôt fédéral brut après quotité -- */
  const impotBrutFederal = Math.max(0, impotAvantQuotite - reductionQuotite);

  /* -- 5. Additionnel communal (appliqué sur l'impôt fédéral) -- */
  const additionnelCommunalEur =
    impotBrutFederal * (additionnelCommunal / 100);

  const impotTotal = impotBrutFederal + additionnelCommunalEur;

  /* -- 6. Indicateurs synthétiques -- */
  const tauxMoyen =
    revenuAnnuelImposable > 0
      ? (impotTotal / revenuAnnuelImposable) * 100
      : 0;
  const tauxMarginal = tauxMarginalPour(revenuAnnuelImposable) * 100;
  const revenuNetApresImpot = revenuAnnuelImposable - impotTotal;

  return {
    impotTotal,
    impotBrutFederal,
    additionnelCommunalEur,
    reductionQuotite,
    quotiteExemptee,
    tauxMoyen,
    tauxMarginal,
    revenuNetApresImpot,
    tranches,
  };
}
