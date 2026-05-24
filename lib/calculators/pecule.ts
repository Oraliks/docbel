/**
 * Calcul du pécule de vacances belge — version simplifiée 2026.
 *
 * Sources :
 *  - ONVA (Office National des Vacances Annuelles) — onva-rjv.fgov.be
 *  - SPF Sécurité Sociale — securitesociale.belgium.be
 *  - SPF Emploi, Travail et Concertation sociale — emploi.belgique.be
 *  - SPF Finances — Précompte professionnel spécial sur double pécule
 *    (barème dégressif par tranches de brut annuel).
 *
 * Deux régimes distincts en Belgique :
 *
 *  1) EMPLOYÉS (privé) — payé par l'employeur, en général en juin.
 *     - Pécule simple = salaire normal du mois de vacances. Imposé comme
 *       un salaire ordinaire (précompte courant). Net ≈ 60 % du brut.
 *     - Double pécule = 92 % du brut mensuel × (mois prestés N-1 / 12).
 *       Soumis à ONSS spéciale 13,07 % puis précompte SPÉCIAL DÉGRESSIF
 *       selon le brut annuel équivalent :
 *         · ≤ 17 670 €    → 17,16 %
 *         · 17 670–65 200 → 30,28 %
 *         · > 65 200 €    → 53,50 %
 *
 *  2) OUVRIERS (privé) — payé par l'ONVA en mai/juin.
 *     - Pécule total brut = 15,38 % × (salaire brut total N-1 × 1,08).
 *       Le coefficient 1,08 est la majoration légale des salaires
 *       déclarés. 8 % du total correspond au pécule simple (4 sem
 *       de congés payés), 7,38 % au double pécule.
 *     - Retenue à la source 23,22 % (ONSS + précompte) → net ≈ 76,78 %.
 *
 *  3) PÉCULE JEUNES (employé < 25 ans, première année après études) —
 *     versé par l'ONEM si la 1re année n'a pas suffi à constituer
 *     un pécule complet. À demander avant fin février de l'année N+1.
 *
 * Ajustement temps partiel : multiplication par le taux d'occupation.
 *
 * Jours assimilés : maladie, chômage temporaire, congé maternité comptent
 * comme prestés pour le pécule. L'utilisateur peut les inclure dans les
 * "mois prestés" (info pédagogique côté UI).
 *
 * AVERTISSEMENT : ce calcul est INDICATIF. Le montant réel dépend de la
 * fiche de paie (employé) ou du décompte ONVA officiel (ouvrier), qui
 * tient compte de jours assimilés, primes, indemnités, secteur, etc.
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
   * N'affecte pas le calcul, sert juste à activer une mention dans le résultat.
   */
  jeuneTravailleur?: boolean;
}

export interface PeculeResult {
  statut: "employe" | "ouvrier";
  /** Pécule simple brut (le "salaire de vacances" normal). */
  peculeSimpleBrut: number;
  /** Pécule simple net estimé (imposé comme un salaire ordinaire). */
  peculeSimpleNetEstime: number;
  /** Double pécule brut (la prime extra-légale). */
  doublePeculeBrut: number;
  /** Estimation nette du double pécule après ONSS + précompte. */
  doublePeculeNetEstime: number;
  /**
   * Taux de précompte spécial effectivement appliqué sur le double
   * pécule (employé). Pour transparence pédagogique. Pour l'ouvrier :
   * 23,22 % (retenue ONVA globale).
   */
  tauxPrecompteAppliquePourcent: number;
  /** Somme brute totale (simple + double). */
  totalBrut: number;
  /**
   * Estimation nette totale.
   *  - Employé : simple net + double net (les deux avec leur taux propre).
   *  - Ouvrier : ONVA verse un montant brut unique → net = brut × 0,7678.
   */
  totalNetEstime: number;
  /** Mention "vous avez peut-être droit au pécule jeunes ONEM". */
  peculeJeunesEligible: boolean;
}

/** Net moyen estimé d'un salaire mensuel brut classique (privé). */
const SALAIRE_NET_RATIO_INDICATIF = 0.6;

/** Retenue ONVA (ONSS + précompte) sur pécule ouvrier. */
const ONVA_NET_RATIO = 0.7678;

/** Taux ONVA global (pour affichage transparence). */
const ONVA_RETENUE_POURCENT = 23.22;

/** Coefficient ONVA de majoration des salaires déclarés. */
const ONVA_COEF_MAJORATION = 1.08;

/** Taux global ONVA appliqué au brut majoré. */
const ONVA_TAUX_TOTAL = 0.1538;

/**
 * Part "pécule simple" dans le total ONVA.
 * Officiellement : 8 % (simple) + 7,38 % (double) = 15,38 % total.
 */
const ONVA_PART_SIMPLE = 0.08 / ONVA_TAUX_TOTAL; // ≈ 0,520

/** Annualisation approximative pour un ouvrier (12 mois + prime + bonus). */
const OUVRIER_COEF_ANNUEL = 13.92;

/** ONSS spéciale prélevée sur le double pécule employé (avant précompte). */
const ONSS_SPECIALE_DOUBLE_PECULE = 0.1307;

/**
 * Barème dégressif du précompte spécial sur double pécule (employé).
 * Tranches en brut annuel équivalent.
 */
const PRECOMPTE_DOUBLE_PECULE_TRANCHES = [
  { plafond: 17_670, taux: 0.1716 },
  { plafond: 65_200, taux: 0.3028 },
  { plafond: Infinity, taux: 0.535 },
] as const;

/**
 * Renvoie le taux de précompte spécial à appliquer sur le double pécule
 * en fonction du brut annuel équivalent.
 */
function tauxPrecompteSpecialDoublePecule(brutAnnuel: number): number {
  for (const t of PRECOMPTE_DOUBLE_PECULE_TRANCHES) {
    if (brutAnnuel <= t.plafond) return t.taux;
  }
  return PRECOMPTE_DOUBLE_PECULE_TRANCHES[
    PRECOMPTE_DOUBLE_PECULE_TRANCHES.length - 1
  ].taux;
}

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

  // Pécule jeunes : seulement pertinent pour les employés (ouvriers
  // sont déjà gérés via ONVA même en début de carrière). On laisse
  // l'utilisateur décider, on ne filtre pas par statut côté logique.
  const peculeJeunesEligible = jeuneTravailleur && statut === "employe";

  // --- Régime EMPLOYÉ ---------------------------------------------------
  if (statut === "employe") {
    // Le pécule simple = salaire normal du mois pendant les congés.
    // Proratisé selon les mois prestés N-1 et le temps de travail.
    const peculeSimpleBrut = brutMensuel * fractionAnnee * tpCoef;

    // Imposé comme un salaire normal → net ≈ 60 % du brut.
    const peculeSimpleNetEstime = peculeSimpleBrut * SALAIRE_NET_RATIO_INDICATIF;

    // Double pécule = 92 % du brut mensuel, proratisé.
    const doublePeculeBrut = brutMensuel * 0.92 * fractionAnnee * tpCoef;

    // Détermine le taux de précompte spécial dégressif en fonction du
    // brut annuel équivalent (12 × brutMensuel × tpCoef).
    const brutAnnuelEquivalent = brutMensuel * 12 * tpCoef;
    const tauxPrecompteSpecial =
      tauxPrecompteSpecialDoublePecule(brutAnnuelEquivalent);

    // Net du double pécule = brut × (1 - ONSS spé) × (1 - précompte spé).
    const apresOnss = doublePeculeBrut * (1 - ONSS_SPECIALE_DOUBLE_PECULE);
    const doublePeculeNetEstime = apresOnss * (1 - tauxPrecompteSpecial);

    const totalBrut = peculeSimpleBrut + doublePeculeBrut;
    const totalNetEstime = peculeSimpleNetEstime + doublePeculeNetEstime;

    return {
      statut: "employe",
      peculeSimpleBrut,
      peculeSimpleNetEstime,
      doublePeculeBrut,
      doublePeculeNetEstime,
      tauxPrecompteAppliquePourcent: tauxPrecompteSpecial * 100,
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

  // Net estimé : 76,78 % du brut (retenue 23,22 %).
  const totalNetEstime = peculeTotalBrut * ONVA_NET_RATIO;
  const peculeSimpleNetEstime = peculeSimpleBrut * ONVA_NET_RATIO;
  const doublePeculeNetEstime = doublePeculeBrut * ONVA_NET_RATIO;

  return {
    statut: "ouvrier",
    peculeSimpleBrut,
    peculeSimpleNetEstime,
    doublePeculeBrut,
    doublePeculeNetEstime,
    tauxPrecompteAppliquePourcent: ONVA_RETENUE_POURCENT,
    totalBrut: peculeTotalBrut,
    totalNetEstime,
    peculeJeunesEligible,
  };
}
