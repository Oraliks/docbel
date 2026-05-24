/**
 * Calcul du pécule de vacances belge — version 2026.
 *
 * Sources officielles (vérifiées 2026-05) :
 *  - SPF Finances — Barème précompte professionnel 2026 (Annexe III AR/CIR 92),
 *    points 53-55 : « Pécule de vacances et allocations exceptionnelles ».
 *  - ONVA (Office National des Vacances Annuelles) — onva.fgov.be
 *  - SPF Sécurité Sociale — securitesociale.belgium.be
 *  - SPF Emploi, Travail et Concertation sociale — emploi.belgique.be
 *  - ONEM — Vacances-jeunes (formulaire C103).
 *
 * Deux régimes distincts en Belgique :
 *
 *  1) EMPLOYÉS (privé) — payé par l'employeur, en général en juin.
 *     - Pécule SIMPLE = salaire normal pendant les congés. Imposé selon
 *       le barème officiel « pécule de vacances » (11 tranches, 0 à 53,50 %).
 *     - Pécule DOUBLE = 92 % du brut mensuel × (mois prestés N-1 / 12).
 *       Soumis à ONSS spéciale 13,07 % puis au barème officiel
 *       « allocations exceptionnelles » (11 tranches, 0 à 53,50 %).
 *
 *  2) OUVRIERS (privé) — payé par l'ONVA en mai/juin.
 *     - Pécule total brut = 15,38 % × (salaire brut total N-1 × 1,08).
 *       Coef 1,08 = majoration légale des salaires déclarés ; 8 % du
 *       total = pécule simple (4 sem de congés payés), 7,38 % = double.
 *     - Retenue à la source : ONSS spéciale 13,07 % + cotisation
 *       solidarité 1 % + précompte spécial (17,16 % si pécule
 *       imposable ≤ 1 740 € ; 23,22 % au-delà).
 *
 *  3) PÉCULE JEUNES — vacances-jeunes ONEM (employé) :
 *     - Conditions : < 25 ans au 31/12 de l'exercice de vacances,
 *       études terminées au cours de l'exercice, au moins 13 jours
 *       prestés sur ≥ 1 mois de contrat.
 *     - Montant : 65 % du salaire plafonné par jour de vacances-jeunes.
 *     - Demande : formulaire C103 à l'organisme de paiement, à
 *       transmettre à l'ONEM avant fin février N+1.
 *
 * Ajustement temps partiel : multiplication par le taux d'occupation.
 *
 * Jours assimilés (maladie, chômage temporaire, congé maternité) comptent
 * comme prestés pour le pécule.
 *
 * AVERTISSEMENT : ce calcul est INDICATIF. Le montant réel dépend de la
 * fiche de paie (employé) ou du décompte ONVA officiel (ouvrier).
 */

export interface PeculeInput {
  statut: "employe" | "ouvrier";
  /** Brut mensuel (employé : année en cours ; ouvrier : moyenne N-1). */
  brutMensuel: number;
  /** Nombre de mois prestés l'année précédente (0-12). */
  moisPrestes: number;
  /** True = travail à temps partiel, applique tauxOccupation. */
  tempsPartiel: boolean;
  /** Taux d'occupation en % (1-100). Ignoré si tempsPartiel = false. */
  tauxOccupation: number;
  /**
   * Première année après études (< 25 ans) → pécule jeunes ONEM possible.
   * Ne change pas le calcul, sert juste à activer la mention dans le résultat.
   */
  jeuneTravailleur?: boolean;
}

export interface PeculeResult {
  statut: "employe" | "ouvrier";
  /** Pécule simple brut (le "salaire de vacances" normal). */
  peculeSimpleBrut: number;
  /** Pécule simple net estimé (barème SPF « pécule de vacances »). */
  peculeSimpleNetEstime: number;
  /** Double pécule brut (la prime extra-légale). */
  doublePeculeBrut: number;
  /** Estimation nette du double pécule après ONSS + précompte spécial. */
  doublePeculeNetEstime: number;
  /**
   * Taux moyen effectivement appliqué sur le double pécule (employé)
   * — pour transparence pédagogique. Pour l'ouvrier : retenue ONVA
   * globale (ONSS 13,07 % + solidarité 1 % + précompte 17,16 ou 23,22 %).
   */
  tauxPrecompteAppliquePourcent: number;
  /** Somme brute totale (simple + double). */
  totalBrut: number;
  /** Estimation nette totale (simple_net + double_net). */
  totalNetEstime: number;
  /** Mention "vous avez peut-être droit aux vacances-jeunes ONEM". */
  peculeJeunesEligible: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constantes officielles 2026                                       */
/* ------------------------------------------------------------------ */

/** Taux du double pécule employé : 92 % du brut mensuel. */
export const TAUX_DOUBLE_PECULE_EMPLOYE = 0.92;

/** ONSS spéciale prélevée sur le double pécule employé (avant précompte). */
export const ONSS_SPECIALE_DOUBLE_PECULE = 0.1307;

/** Coefficient ONVA de majoration des salaires déclarés. */
export const ONVA_COEF_MAJORATION = 1.08;

/** Taux global ONVA appliqué au brut majoré (= 8 % simple + 7,38 % double). */
export const ONVA_TAUX_TOTAL = 0.1538;

/** Part du pécule simple dans le total ONVA (8 / 15,38). */
const ONVA_PART_SIMPLE = 0.08 / ONVA_TAUX_TOTAL; // ≈ 0,520

/** Annualisation approximative pour un ouvrier (12 mois + prime + bonus). */
const OUVRIER_COEF_ANNUEL = 13.92;

/** Cotisation de solidarité ONVA sur pécule brut. */
export const ONVA_COTISATION_SOLIDARITE = 0.01;

/** Précompte ONVA tranche basse (pécule imposable ≤ 1 740 €). */
export const ONVA_PRECOMPTE_BAS = 0.1716;

/** Précompte ONVA tranche haute (pécule imposable > 1 740 €). */
export const ONVA_PRECOMPTE_HAUT = 0.2322;

/** Seuil de bascule entre les deux tranches précompte ONVA (€, 2026). */
export const ONVA_SEUIL_PRECOMPTE = 1740;

/**
 * Barème SPF Finances 2026 — précompte professionnel sur PÉCULE DE VACANCES
 * EMPLOYÉ (pécule simple). Tranches de rémunération annuelle brute.
 * Source : Annexe III AR/CIR 92, points 53-55 (via Securex).
 */
export const PRECOMPTE_PECULE_SIMPLE_EMPLOYE = [
  { plafond: 10_675, taux: 0 },
  { plafond: 13_660, taux: 0.1917 },
  { plafond: 17_375, taux: 0.212 },
  { plafond: 20_840, taux: 0.2625 },
  { plafond: 23_580, taux: 0.313 },
  { plafond: 26_340, taux: 0.3433 },
  { plafond: 31_830, taux: 0.3634 },
  { plafond: 34_640, taux: 0.3937 },
  { plafond: 45_860, taux: 0.4239 },
  { plafond: 59_900, taux: 0.4744 },
  { plafond: Infinity, taux: 0.535 },
] as const;

/**
 * Barème SPF Finances 2026 — précompte professionnel sur ALLOCATIONS
 * EXCEPTIONNELLES (DOUBLE PÉCULE, prime fin d'année, gratification).
 * Tranches de rémunération annuelle brute.
 * Source : Annexe III AR/CIR 92, points 53-55 (via Securex).
 */
export const PRECOMPTE_DOUBLE_PECULE_EMPLOYE = [
  { plafond: 10_675, taux: 0 },
  { plafond: 13_660, taux: 0.2322 },
  { plafond: 17_375, taux: 0.2523 },
  { plafond: 20_840, taux: 0.3028 },
  { plafond: 23_580, taux: 0.3533 },
  { plafond: 26_340, taux: 0.3836 },
  { plafond: 31_830, taux: 0.4038 },
  { plafond: 34_640, taux: 0.4341 },
  { plafond: 45_860, taux: 0.4644 },
  { plafond: 59_900, taux: 0.5148 },
  { plafond: Infinity, taux: 0.535 },
] as const;

/**
 * Renvoie le taux SPF (pécule simple ou double) selon la rémunération
 * annuelle brute et le barème choisi.
 */
function tauxBareme(
  bareme: ReadonlyArray<{ plafond: number; taux: number }>,
  brutAnnuel: number,
): number {
  for (const t of bareme) {
    if (brutAnnuel <= t.plafond) return t.taux;
  }
  return bareme[bareme.length - 1].taux;
}

/* ------------------------------------------------------------------ */
/*  Calcul                                                             */
/* ------------------------------------------------------------------ */

export function calcPecule(
  input: PeculeInput,
): PeculeResult | { error: string } {
  const {
    statut,
    brutMensuel,
    moisPrestes,
    tempsPartiel,
    tauxOccupation,
    jeuneTravailleur = false,
  } = input;

  // --- Validation des inputs --------------------------------------------
  if (!Number.isFinite(brutMensuel) || brutMensuel < 100 || brutMensuel > 50000) {
    return { error: "Le brut mensuel doit être compris entre 100 et 50000 €." };
  }
  if (
    !Number.isFinite(moisPrestes) ||
    moisPrestes < 0 ||
    moisPrestes > 12
  ) {
    return { error: "Le nombre de mois prestés doit être compris entre 0 et 12." };
  }
  if (
    tempsPartiel &&
    (!Number.isFinite(tauxOccupation) ||
      tauxOccupation < 1 ||
      tauxOccupation > 100)
  ) {
    return { error: "Le taux d'occupation doit être compris entre 1 et 100 %." };
  }

  // Coefficient d'ajustement temps partiel (1 si temps plein).
  const tpCoef = tempsPartiel ? tauxOccupation / 100 : 1;
  const fractionAnnee = moisPrestes / 12;

  // Pécule jeunes : pertinent pour les employés uniquement (les ouvriers
  // sont déjà gérés via ONVA même en début de carrière).
  const peculeJeunesEligible = jeuneTravailleur && statut === "employe";

  // --- Régime EMPLOYÉ ---------------------------------------------------
  if (statut === "employe") {
    // Le pécule simple = salaire normal du mois pendant les congés.
    // Proratisé selon les mois prestés N-1 et le temps de travail.
    const peculeSimpleBrut = brutMensuel * fractionAnnee * tpCoef;

    // Double pécule = 92 % du brut mensuel, proratisé.
    const doublePeculeBrut =
      brutMensuel * TAUX_DOUBLE_PECULE_EMPLOYE * fractionAnnee * tpCoef;

    // Brut annuel équivalent (= 12 × brutMensuel × tpCoef) pour
    // déterminer la tranche fiscale.
    const brutAnnuelEquivalent = brutMensuel * 12 * tpCoef;

    // Pécule simple net : barème « pécule de vacances » SPF (ONSS
    // ordinaire 13,07 % déjà appliquée sur le salaire normal, on
    // applique ici uniquement le précompte spécifique simple).
    const tauxSimple = tauxBareme(
      PRECOMPTE_PECULE_SIMPLE_EMPLOYE,
      brutAnnuelEquivalent,
    );
    // L'ONSS de 13,07 % est en général déjà retenue sur le salaire
    // courant qui sert d'assiette ; le pécule simple suit le barème
    // SPF dédié appliqué sur le brut. Pour cohérence pédagogique on
    // applique aussi 13,07 % d'ONSS sur la base (cf. Securex).
    const peculeSimpleApresOnss =
      peculeSimpleBrut * (1 - ONSS_SPECIALE_DOUBLE_PECULE);
    const peculeSimpleNetEstime =
      peculeSimpleApresOnss * (1 - tauxSimple);

    // Double pécule net : ONSS spéciale 13,07 % puis barème
    // « allocations exceptionnelles » SPF.
    const tauxDouble = tauxBareme(
      PRECOMPTE_DOUBLE_PECULE_EMPLOYE,
      brutAnnuelEquivalent,
    );
    const doublePeculeApresOnss =
      doublePeculeBrut * (1 - ONSS_SPECIALE_DOUBLE_PECULE);
    const doublePeculeNetEstime = doublePeculeApresOnss * (1 - tauxDouble);

    const totalBrut = peculeSimpleBrut + doublePeculeBrut;
    const totalNetEstime = peculeSimpleNetEstime + doublePeculeNetEstime;

    return {
      statut: "employe",
      peculeSimpleBrut,
      peculeSimpleNetEstime,
      doublePeculeBrut,
      doublePeculeNetEstime,
      tauxPrecompteAppliquePourcent: tauxDouble * 100,
      totalBrut,
      totalNetEstime,
      peculeJeunesEligible,
    };
  }

  // --- Régime OUVRIER (ONVA) -------------------------------------------
  // Annualisation : brut mensuel × 13,92 (12 mois + prime fin année + bonus).
  const totalAnnuelBrut =
    brutMensuel * OUVRIER_COEF_ANNUEL * fractionAnnee;

  // Brut majoré × taux ONVA = pécule total brut.
  const peculeTotalBrut =
    totalAnnuelBrut * ONVA_COEF_MAJORATION * ONVA_TAUX_TOTAL * tpCoef;

  const peculeSimpleBrut = peculeTotalBrut * ONVA_PART_SIMPLE;
  const doublePeculeBrut = peculeTotalBrut - peculeSimpleBrut;

  // Retenue ONVA : ONSS spéciale 13,07 % + solidarité 1 %
  // + précompte (17,16 % si pécule imposable ≤ 1 740 €, sinon 23,22 %).
  const tauxPrecompteOnva =
    peculeTotalBrut <= ONVA_SEUIL_PRECOMPTE
      ? ONVA_PRECOMPTE_BAS
      : ONVA_PRECOMPTE_HAUT;
  const retenueTotalePourcent =
    ONSS_SPECIALE_DOUBLE_PECULE +
    ONVA_COTISATION_SOLIDARITE +
    tauxPrecompteOnva;
  const netRatio = 1 - retenueTotalePourcent;

  const totalNetEstime = peculeTotalBrut * netRatio;
  const peculeSimpleNetEstime = peculeSimpleBrut * netRatio;
  const doublePeculeNetEstime = doublePeculeBrut * netRatio;

  return {
    statut: "ouvrier",
    peculeSimpleBrut,
    peculeSimpleNetEstime,
    doublePeculeBrut,
    doublePeculeNetEstime,
    tauxPrecompteAppliquePourcent: retenueTotalePourcent * 100,
    totalBrut: peculeTotalBrut,
    totalNetEstime,
    peculeJeunesEligible,
  };
}
