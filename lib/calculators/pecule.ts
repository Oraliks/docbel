/**
 * Calcul du pécule de vacances belge — version simplifiée 2026.
 *
 * Sources :
 *  - ONVA (Office National des Vacances Annuelles) — onva-rjv.fgov.be
 *  - SPF Sécurité Sociale — securitesociale.belgium.be
 *  - SPF Emploi, Travail et Concertation sociale — emploi.belgique.be
 *
 * Deux régimes distincts en Belgique :
 *
 *  1) EMPLOYÉS (privé) — payé par l'employeur, en général en juin.
 *     - Pécule simple = salaire normal du mois de vacances (déjà inclus
 *       dans la rémunération mensuelle, "ne change rien" sur la fiche
 *       du mois où l'on prend les congés).
 *     - Double pécule = 92 % du brut mensuel × (mois prestés N-1 / 12).
 *       Soumis à ONSS spéciale 13,07 % puis précompte spécial dégressif
 *       (~25 à 50 % selon le brut). Net estimé via coefficient 0,567.
 *
 *  2) OUVRIERS (privé) — payé par l'ONVA en mai/juin.
 *     - Pécule total brut = 15,38 % × (salaire brut total N-1 × 1,08).
 *       Le coefficient 1,08 est la majoration légale des salaires
 *       déclarés. 6,8 % du total correspond au pécule simple (4 sem
 *       de congés payés), 8,58 % au double pécule.
 *     - Retenue à la source 23,22 % (ONSS + précompte) → net ≈ 76,78 %.
 *
 * Ajustement temps partiel : multiplication par le taux d'occupation.
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
}

export interface PeculeResult {
  statut: "employe" | "ouvrier";
  /** Pécule simple brut (le "salaire de vacances" normal). */
  peculeSimpleBrut: number;
  /** Double pécule brut (la prime extra-légale). */
  doublePeculeBrut: number;
  /** Estimation nette du double pécule après ONSS + précompte. */
  doublePeculeNetEstime: number;
  /** Somme brute totale (simple + double). */
  totalBrut: number;
  /**
   * Estimation nette totale.
   *  - Employé : simple est neutre (inclus dans salaire mensuel) → on n'ajoute
   *    pas de net "simple", on renvoie le net estimé du double seulement comme
   *    "gain net réel sur la fiche de juin". Pour cohérence d'affichage,
   *    totalNetEstime = peculeSimpleBrut × ~0.60 + doublePeculeNetEstime
   *    (on traite le simple comme un salaire mensuel standard ~60% net).
   *  - Ouvrier : ONVA verse un montant brut unique → net = brut × 0,7678.
   */
  totalNetEstime: number;
}

/** Coefficient net moyen sur le double pécule (après ONSS spé + précompte). */
const DOUBLE_PECULE_NET_RATIO = 0.567;

/** Net moyen estimé d'un salaire mensuel brut classique (privé). */
const SALAIRE_NET_RATIO_INDICATIF = 0.6;

/** Retenue ONVA (ONSS + précompte) sur pécule ouvrier. */
const ONVA_NET_RATIO = 0.7678;

/** Coefficient ONVA de majoration des salaires déclarés. */
const ONVA_COEF_MAJORATION = 1.08;

/** Taux global ONVA appliqué au brut majoré. */
const ONVA_TAUX_TOTAL = 0.1538;

/**
 * Part "pécule simple" dans le total ONVA.
 * Officiellement : 8 % (simple) + 7,38 % (double) = 15,38 % total.
 * (La valeur précédente 0,068 sous-estimait la part simple.)
 */
const ONVA_PART_SIMPLE = 0.08 / ONVA_TAUX_TOTAL; // ≈ 0,520

/** Annualisation approximative pour un ouvrier (12 mois + prime + bonus). */
const OUVRIER_COEF_ANNUEL = 13.92;

export function calcPecule(
  input: PeculeInput,
): PeculeResult | { error: string } {
  const { statut, brutMensuel, moisPrestes, tempsPartiel, tauxOccupation } =
    input;

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

  // --- Régime EMPLOYÉ ---------------------------------------------------
  if (statut === "employe") {
    // Le pécule simple = salaire normal du mois pendant les congés.
    // Proratisé selon les mois prestés N-1 et le temps de travail.
    const peculeSimpleBrut = brutMensuel * fractionAnnee * tpCoef;

    // Double pécule = 92 % du brut mensuel, proratisé.
    const doublePeculeBrut = brutMensuel * 0.92 * fractionAnnee * tpCoef;

    // Net estimé du double pécule (ONSS spé + précompte dégressif).
    const doublePeculeNetEstime = doublePeculeBrut * DOUBLE_PECULE_NET_RATIO;

    const totalBrut = peculeSimpleBrut + doublePeculeBrut;
    const totalNetEstime =
      peculeSimpleBrut * SALAIRE_NET_RATIO_INDICATIF + doublePeculeNetEstime;

    return {
      statut: "employe",
      peculeSimpleBrut,
      doublePeculeBrut,
      doublePeculeNetEstime,
      totalBrut,
      totalNetEstime,
    };
  }

  // --- Régime OUVRIER (ONVA) -------------------------------------------
  // Annualisation : brut mensuel × 13,92 (12 mois + prime fin année + bonus).
  const totalAnnuelBrut = brutMensuel * OUVRIER_COEF_ANNUEL * fractionAnnee;

  // Brut majoré × taux ONVA = pécule total brut.
  const peculeTotalBrut =
    totalAnnuelBrut * ONVA_COEF_MAJORATION * ONVA_TAUX_TOTAL * tpCoef;

  const peculeSimpleBrut = peculeTotalBrut * ONVA_PART_SIMPLE;
  const doublePeculeBrut = peculeTotalBrut - peculeSimpleBrut;

  // Net estimé : 76,78 % du brut (retenue 23,22 %).
  const totalNetEstime = peculeTotalBrut * ONVA_NET_RATIO;
  // Pour cohérence d'affichage on calcule aussi un "net du double pécule".
  const doublePeculeNetEstime = doublePeculeBrut * ONVA_NET_RATIO;

  return {
    statut: "ouvrier",
    peculeSimpleBrut,
    doublePeculeBrut,
    doublePeculeNetEstime,
    totalBrut: peculeTotalBrut,
    totalNetEstime,
  };
}
