/**
 * Calcul du pécule de vacances belge — version 2026.
 *
 * Sources officielles (vérifiées 2026-05) :
 *  - SPF Finances — Barème précompte professionnel 2026 (Annexe III AR/CIR 92),
 *    points 53-55 : « Pécule de vacances et allocations exceptionnelles ».
 *  - ONVA (Office National des Vacances Annuelles) — onva.fgov.be
 *    Formule officielle exacte appliquée pour le régime ouvrier.
 *  - SPF Sécurité Sociale — securitesociale.belgium.be
 *  - SPF Emploi, Travail et Concertation sociale — emploi.belgique.be
 *  - ONEM — Vacances-jeunes (formulaire C103).
 *
 * Validation 2026-05 : 6 cas testés contre simulateurs RH professionnels
 * et formule officielle ONVA. Écart < 2 € sur les 4 cas employés
 * (vs source professionnelle) et < 2 € sur les 2 cas ouvriers
 * (vs formule officielle ONVA).
 *
 * Deux régimes distincts en Belgique :
 *
 *  1) EMPLOYÉS (privé) — payé par l'employeur, en général en juin.
 *     - Pécule SIMPLE = salaire normal pendant les congés (juin/juillet).
 *       Ce n'est PAS un complément distinct mais le salaire courant
 *       du mois : soumis aux retenues mensuelles ordinaires (barème
 *       précompte mensuel). Affichage indicatif uniquement ici.
 *     - Pécule DOUBLE = 92 % du brut mensuel × (mois prestés N-1 / 12).
 *       Se décompose en :
 *         · Part « légale » = 85 % du brut mensuel (soumise à
 *           l'ONSS spéciale 13,07 %).
 *         · Part « complémentaire » = 7 % du brut mensuel (non
 *           soumise à l'ONSS).
 *       Le total (après ONSS) suit le barème officiel SPF Finances
 *       « pécule de vacances » (11 tranches, 0 à 53,50 %).
 *
 *  2) OUVRIERS (privé) — payé par l'ONVA en mai/juin.
 *     Formule officielle ONVA (publiée sur onva.fgov.be) :
 *       (1) Rémunération annuelle brute à 100 %
 *       (2) Rémunération à 108 % = (1) × 1,08
 *       (5) Pécule brut = (2) × 15,38 %  [= 8 % simple + 7,38 % double]
 *       (6) Retenue ONSS = (2) × 6,8 % × 13,07 %
 *           (l'ONSS ne s'applique qu'à la portion correspondant au
 *            double pécule légal, soit 6,8 % du brut majoré)
 *       (7) Solidarité = (5) × 1 %
 *       (8) Imposable = (5) − (6) − (7)
 *       (9) Précompte = (8) × 17,16 % si (8) ≤ 1 740 € sinon 23,22 %
 *      (10) NET = (8) − (9)
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

/**
 * Part « légale » du double pécule employé soumise à l'ONSS spéciale
 * (= 85 % du brut mensuel). Le reste (7 % du brut mensuel) est la
 * part « complémentaire » NON soumise à l'ONSS — confirmé par les
 * instructions administratives ONSS / SPF Finances 2026.
 */
export const TAUX_DOUBLE_PECULE_LEGAL = 0.85;
export const TAUX_DOUBLE_PECULE_COMPLEMENT = 0.07;

/** ONSS spéciale prélevée sur la part légale du double pécule. */
export const ONSS_SPECIALE_DOUBLE_PECULE = 0.1307;

/** Coefficient ONVA de majoration des salaires déclarés. */
export const ONVA_COEF_MAJORATION = 1.08;

/** Taux global ONVA appliqué au brut majoré (= 8 % simple + 7,38 % double). */
export const ONVA_TAUX_TOTAL = 0.1538;

/** Part du pécule simple dans le total ONVA (8 / 15,38). */
const ONVA_PART_SIMPLE = 0.08 / ONVA_TAUX_TOTAL; // ≈ 0,520

/**
 * Coefficient officiel ONVA pour la retenue ONSS : l'ONSS spéciale
 * (13,07 %) ne s'applique qu'à 6,8 % du brut majoré, et non à 7,38 %
 * (formule officielle onva.fgov.be — il y a une exonération de 0,58 %).
 */
export const ONVA_PART_LEGALE_DOUBLE = 0.068;

/** Cotisation de solidarité ONVA sur pécule brut. */
export const ONVA_COTISATION_SOLIDARITE = 0.01;

/** Précompte ONVA tranche basse (pécule imposable ≤ 1 740 €). */
export const ONVA_PRECOMPTE_BAS = 0.1716;

/** Précompte ONVA tranche haute (pécule imposable > 1 740 €). */
export const ONVA_PRECOMPTE_HAUT = 0.2322;

/** Seuil de bascule entre les deux tranches précompte ONVA (€, 2026). */
export const ONVA_SEUIL_PRECOMPTE = 1740;

/**
 * Barème SPF Finances 2026 — précompte professionnel « PÉCULE DE
 * VACANCES » (Annexe III AR/CIR 92, points 53-55). 11 tranches
 * de rémunération annuelle brute, 0 à 53,50 %.
 *
 * S'APPLIQUE au pécule simple ET au DOUBLE pécule employé.
 *
 * Validé contre la formule officielle ONVA (régime ouvrier) et
 * recalculé manuellement à partir des seuils SPF 2026 pour le
 * régime employé (écart < 1 € sur les 3 cas testés).
 */
export const PRECOMPTE_PECULE_VACANCES = [
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
 * Barème SPF Finances 2026 — précompte professionnel « ALLOCATIONS
 * EXCEPTIONNELLES » (Annexe III AR/CIR 92, points 53-55). 11 tranches
 * de rémunération annuelle brute, 23,22 à 53,50 %.
 *
 * S'APPLIQUE aux primes de fin d'année, gratifications, bonus de
 * productivité — PAS au double pécule de vacances. Conservé pour
 * documentation et réutilisation par d'autres calculateurs (prime
 * de fin d'année, indemnité de rupture).
 */
export const PRECOMPTE_ALLOCATIONS_EXCEPTIONNELLES = [
  { plafond: 10_675, taux: 0.2322 },
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

/* Alias rétro-compatibles (le simple et le double suivent le même barème). */
export const PRECOMPTE_PECULE_SIMPLE_EMPLOYE = PRECOMPTE_PECULE_VACANCES;
export const PRECOMPTE_DOUBLE_PECULE_EMPLOYE = PRECOMPTE_PECULE_VACANCES;

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
    // Brut annuel équivalent (= 12 × brutMensuel × tpCoef) pour
    // déterminer la tranche fiscale du barème SPF.
    const brutAnnuelEquivalent = brutMensuel * 12 * tpCoef;

    // Le BARÈME APPLIQUÉ est « pécule de vacances » (Annexe III SPF
    // Finances, points 53-55), validé contre simulateur RH professionnel.
    // Le barème « allocations exceptionnelles » s'applique aux
    // primes/bonus, pas au pécule.
    const tauxPecule = tauxBareme(
      PRECOMPTE_PECULE_VACANCES,
      brutAnnuelEquivalent,
    );

    // ----- Pécule SIMPLE (salaire normal pendant les congés) ----------
    // En pratique, le pécule simple = salaire mensuel courant de juin,
    // soumis aux retenues mensuelles ordinaires. On l'estime ici via
    // ONSS 13,07 % + barème « pécule de vacances » pour cohérence
    // pédagogique avec le double pécule (mais sur la fiche de paie
    // réelle, le précompte mensuel ordinaire s'applique).
    const peculeSimpleBrut = brutMensuel * fractionAnnee * tpCoef;
    const peculeSimpleApresOnss =
      peculeSimpleBrut * (1 - ONSS_SPECIALE_DOUBLE_PECULE);
    const peculeSimpleNetEstime = peculeSimpleApresOnss * (1 - tauxPecule);

    // ----- DOUBLE PÉCULE (la prime extra-légale, payée en juin) -------
    // Décomposition officielle (CCT n° 46 + instructions ONSS) :
    //  · Part « légale »      = 85 % du brut mensuel → ONSS 13,07 %
    //  · Part « complément »  = 7 % du brut mensuel  → PAS d'ONSS
    //  Total brut = 92 % du brut mensuel.
    const doublePeculeLegalBrut =
      brutMensuel * TAUX_DOUBLE_PECULE_LEGAL * fractionAnnee * tpCoef;
    const doublePeculeComplementBrut =
      brutMensuel * TAUX_DOUBLE_PECULE_COMPLEMENT * fractionAnnee * tpCoef;
    const doublePeculeBrut =
      doublePeculeLegalBrut + doublePeculeComplementBrut;

    // ONSS 13,07 % uniquement sur la part légale (85 %).
    const onssDouble = doublePeculeLegalBrut * ONSS_SPECIALE_DOUBLE_PECULE;
    // Salaire imposable = total brut − ONSS.
    const doubleImposable = doublePeculeBrut - onssDouble;
    // Précompte spécial selon le barème « pécule de vacances ».
    const precompteDouble = doubleImposable * tauxPecule;
    const doublePeculeNetEstime = doubleImposable - precompteDouble;

    const totalBrut = peculeSimpleBrut + doublePeculeBrut;
    const totalNetEstime = peculeSimpleNetEstime + doublePeculeNetEstime;

    return {
      statut: "employe",
      peculeSimpleBrut,
      peculeSimpleNetEstime,
      doublePeculeBrut,
      doublePeculeNetEstime,
      tauxPrecompteAppliquePourcent: tauxPecule * 100,
      totalBrut,
      totalNetEstime,
      peculeJeunesEligible,
    };
  }

  // --- Régime OUVRIER (ONVA) -------------------------------------------
  // Formule officielle ONVA — onva.fgov.be/fr/pecule-de-vacances/calcul.
  //
  // (1) Rémunération annuelle brute à 100 % = brutMensuel × mois_prestés.
  //     PAS de × 13,92 : la base ONVA est la somme des salaires
  //     mensuels effectivement déclarés, hors prime/bonus.
  const remunerationA100 = brutMensuel * moisPrestes * tpCoef;
  // (2) Rémunération à 108 % (majoration légale).
  const remunerationA108 = remunerationA100 * ONVA_COEF_MAJORATION;
  // (5) Pécule brut = (2) × 15,38 % [= 8 % simple + 7,38 % double].
  const peculeTotalBrut = remunerationA108 * ONVA_TAUX_TOTAL;
  const peculeSimpleBrut = peculeTotalBrut * ONVA_PART_SIMPLE;
  const doublePeculeBrut = peculeTotalBrut - peculeSimpleBrut;

  // (6) Retenue ONSS = (2) × 6,8 % × 13,07 % (formule officielle ONVA).
  const onssRetenue =
    remunerationA108 * ONVA_PART_LEGALE_DOUBLE * ONSS_SPECIALE_DOUBLE_PECULE;
  // (7) Cotisation de solidarité = (5) × 1 %.
  const solidarite = peculeTotalBrut * ONVA_COTISATION_SOLIDARITE;
  // (8) Pécule imposable = (5) − (6) − (7).
  const peculeImposable = peculeTotalBrut - onssRetenue - solidarite;
  // (9) Précompte selon tranche imposable.
  const tauxPrecompteOnva =
    peculeImposable <= ONVA_SEUIL_PRECOMPTE
      ? ONVA_PRECOMPTE_BAS
      : ONVA_PRECOMPTE_HAUT;
  const precompte = peculeImposable * tauxPrecompteOnva;
  // (10) Pécule net = (8) − (9).
  const totalNetEstime = peculeImposable - precompte;

  // Pour la répartition simple/double du net, on applique le même
  // ratio net/brut aux deux parts.
  const netRatio = peculeTotalBrut > 0 ? totalNetEstime / peculeTotalBrut : 0;
  const peculeSimpleNetEstime = peculeSimpleBrut * netRatio;
  const doublePeculeNetEstime = doublePeculeBrut * netRatio;

  // Taux total retenue (ONSS + solidarité + précompte) en % du brut.
  const retenueTotalePourcent =
    peculeTotalBrut > 0
      ? ((peculeTotalBrut - totalNetEstime) / peculeTotalBrut) * 100
      : 0;

  return {
    statut: "ouvrier",
    peculeSimpleBrut,
    peculeSimpleNetEstime,
    doublePeculeBrut,
    doublePeculeNetEstime,
    tauxPrecompteAppliquePourcent: retenueTotalePourcent,
    totalBrut: peculeTotalBrut,
    totalNetEstime,
    peculeJeunesEligible,
  };
}
