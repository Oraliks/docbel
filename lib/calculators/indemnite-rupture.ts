/**
 * Calcul de l'indemnité compensatoire de préavis — salarié belge.
 *
 * Contexte
 * --------
 * Quand l'employeur rompt le contrat sans faire prester le préavis
 * (ou seulement une partie), il doit verser une indemnité égale à la
 * rémunération courante correspondant à la durée du préavis non presté.
 *
 * Base légale : Loi du 3 juillet 1978 sur les contrats de travail,
 * art. 39 et suivants. Régime unique (CCT 109) depuis 2014.
 *
 * Formule
 * -------
 *   - Rémunération mensuelle de base = salaire brut mensuel
 *     (+ avantages annuels / 12, si l'utilisateur les inclut).
 *   - Rémunération hebdomadaire = rémunération mensuelle × 3 / 13
 *     (équivalence légale : 13 semaines = 3 mois).
 *   - Indemnité brute = rémunération hebdomadaire × préavis (semaines).
 *
 * Précompte spécial
 * -----------------
 * Les indemnités de rupture supportent un précompte professionnel
 * "spécial" cumulé, dont le taux dépend du revenu annuel de référence.
 * On applique un barème par tranches (valeurs indicatives 2026,
 * inspirées des barèmes officiels SPF Finances pour le précompte sur
 * arriérés/indemnités de dédit) basé sur brutAnnuel = salaireBrutMensuel
 * × 13.92 (12 mois + 13e + double pécule estimés), pour une estimation
 * plus juste que le taux moyen unique.
 *
 * Cotisation spéciale de compensation employeur (DmfA)
 * ----------------------------------------------------
 * Loi du 26 décembre 2013 — ONSS instructions administratives 2026/1 :
 * l'employeur supporte une cotisation progressive sur la part de
 * l'indemnité de rupture couvrant des prestations effectuées à partir
 * du 1ᵉʳ janvier 2014. Trois tranches actuelles (seuils valables depuis
 * 01/01/2023, encore en vigueur en 2026) :
 *   - rémunération annuelle ≥ 50 166 €      → 1 %
 *   - rémunération annuelle ≥ 61 437 €      → 2 %
 *   - rémunération annuelle ≥ 72 707 €      → 3 %
 * Source: ONSS — Cotisation spéciale sur les indemnités de rupture
 * destinée au Fonds de fermeture des entreprises (DmfA).
 * Pas déduite du net du salarié, mais signalée pour transparence.
 *
 * Indemnité de protection
 * -----------------------
 * Certains statuts (femme enceinte, délégué syndical CCT 5, travailleur
 * protégé) ouvrent droit à une indemnité de protection cumulable. On
 * applique un multiplicateur de mois de rémunération mensuelle.
 *
 * Important : l'indemnité de protection (femme enceinte, délégué
 * syndical, conseiller en prévention) n'est PAS soumise aux cotisations
 * sociales (ONSS, instructions 2026/1, notion de rémunération). Elle est
 * exclue de la base de la cotisation spéciale de compensation.
 *
 * Ce fichier est de la logique pure : pas de React, pas de side-effects.
 */

/** Garde-fou : un préavis raisonnable ne dépasse pas ~4 ans (200 semaines). */
export const PREAVIS_MAX_SEMAINES = 200;

/**
 * Coefficient d'annualisation salaire mensuel → brut annuel de référence.
 * 12 mois + 13e (~1 mois) + double pécule (~0,92 mois) ≈ 13,92.
 */
export const COEF_ANNUALISATION = 13.92;

/**
 * Barème indicatif du précompte spécial 2026 (tranches sur brut annuel).
 * Source: SPF Finances — Précompte professionnel 2026, règles relatives
 * aux arriérés et indemnités de dédit. Valeurs simplifiées en 5 tranches
 * pour une estimation citoyenne pédagogique. Pour un calcul de paie
 * exact, voir l'annexe officielle (~25 tranches détaillées).
 * URL: https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul
 */
interface TranchePrecompte {
  /** Borne supérieure exclusive (en €/an). Infinity pour la dernière. */
  jusqua: number;
  /** Taux appliqué dans cette tranche (en décimal). */
  taux: number;
}
export const BAREME_PRECOMPTE_SPECIAL: TranchePrecompte[] = [
  { jusqua: 17_670, taux: 0.1716 },
  { jusqua: 21_730, taux: 0.2675 },
  { jusqua: 30_220, taux: 0.323 },
  { jusqua: 65_200, taux: 0.418 },
  { jusqua: Infinity, taux: 0.535 },
];

/**
 * Tranches 2026 de la cotisation spéciale de compensation employeur.
 * Source: ONSS — Instructions administratives 2026/1, "Cotisation
 * spéciale sur les indemnités de rupture destinée au Fonds de fermeture
 * des entreprises (DmfA)". Seuils inchangés depuis le 01/01/2023.
 * URL: https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/terminationfeecontribution.html
 */
interface TrancheCotisation {
  /** Seuil de déclenchement (en €/an, rémunération annuelle). */
  seuil: number;
  /** Taux appliqué dans cette tranche (en décimal). */
  taux: number;
}
export const TRANCHES_COTISATION_SPECIALE: TrancheCotisation[] = [
  { seuil: 50_166, taux: 0.01 }, // 1 % entre 50 166 € et 61 437 €
  { seuil: 61_437, taux: 0.02 }, // 2 % entre 61 437 € et 72 707 €
  { seuil: 72_707, taux: 0.03 }, // 3 % au-delà de 72 707 €
];

/** Premier seuil sous lequel aucune cotisation spéciale n'est due. */
export const SEUIL_COTISATION_SPECIALE = TRANCHES_COTISATION_SPECIALE[0].seuil;

/** Statuts ouvrant droit à une indemnité de protection. */
export type ProtectionSpeciale =
  | "aucune"
  | "femme_enceinte"
  | "delegue_syndical"
  | "travailleur_protege";

/**
 * Multiplicateur (en mois de rémunération mensuelle) d'indemnité de
 * protection. Valeurs centrales / typiques — pour cas concret, voir
 * CCT 5 (délégués syndicaux) et lois spécifiques.
 * Source: Loi du 16 mars 1971 art. 40 (femme enceinte), CCT n° 5 art. 20
 * (délégué syndical), Loi du 19 mars 1991 (conseiller en prévention).
 */
export const PROTECTION_MOIS: Record<ProtectionSpeciale, number> = {
  aucune: 0,
  // Loi du 16 mars 1971, art. 40 : 6 mois forfaitaires de rémunération
  // (rémunération en cours + avantages dus en vertu du contrat).
  femme_enceinte: 6,
  // CCT n° 5, art. 20 : 2 à 4 ans selon ancienneté → valeur centrale 3 ans.
  delegue_syndical: 36,
  // Loi du 19 mars 1991 (conseiller en prévention, CPPT) : 6 à 12 mois
  // selon ancienneté — on retient une valeur intermédiaire de 9 mois.
  travailleur_protege: 9,
};

export interface IndemniteInput {
  salaireBrutMensuel: number;
  dureePreavisSemaines: number;
  avantagesAnnuels: number;
  inclureAvantages: boolean;
  precompte: boolean;
  /** Statut de protection spéciale (défaut : aucune). */
  protectionSpeciale?: ProtectionSpeciale;
}

export interface IndemniteResult {
  remunerationMensuelle: number;
  remunerationHebdomadaire: number;
  /** Indemnité standard (rémunération hebdo × semaines de préavis). */
  indemniteBrute: number;
  /** Indemnité supplémentaire liée au statut protégé (0 si "aucune"). */
  indemniteProtectionSupplement: number;
  /** Brute totale = indemniteBrute + indemniteProtectionSupplement. */
  indemniteTotalBrute: number;
  /** Net estimé après précompte (sur le total brut). */
  indemniteNetEstimee: number;
  /** Taux de précompte appliqué (en %), selon la tranche de revenu. */
  tauxPrecompteAppliquePourcent: number;
  /** Cotisation spéciale due par l'employeur (1 / 2 / 3 % si seuils atteints). */
  cotisationSpecialeEmployeur: number;
  /** Taux progressif effectif appliqué pour la cotisation spéciale (en %). */
  tauxCotisationSpecialePourcent: number;
  /** Brut annuel de référence (salaire mensuel × 13,92). */
  brutAnnuelReference: number;
  /** Statut de protection retenu. */
  protectionSpeciale: ProtectionSpeciale;
  preavisSemaines: number;
}

export interface IndemniteError {
  error: string;
}

/** Retourne le taux de précompte spécial pour un brut annuel donné. */
function tauxPrecompteSpecial(brutAnnuel: number): number {
  for (const tranche of BAREME_PRECOMPTE_SPECIAL) {
    if (brutAnnuel <= tranche.jusqua) return tranche.taux;
  }
  // Sécurité : ne devrait jamais être atteint grâce à Infinity.
  return BAREME_PRECOMPTE_SPECIAL[BAREME_PRECOMPTE_SPECIAL.length - 1].taux;
}

/**
 * Retourne le taux progressif (0 / 1 / 2 / 3 %) de la cotisation spéciale
 * de compensation employeur selon le brut annuel de référence.
 * Source: ONSS — Instructions administratives 2026/1.
 */
export function tauxCotisationSpecialeProgressif(brutAnnuel: number): number {
  let taux = 0;
  for (const t of TRANCHES_COTISATION_SPECIALE) {
    if (brutAnnuel >= t.seuil) taux = t.taux;
  }
  return taux;
}

export function calcIndemniteRupture(
  input: IndemniteInput,
): IndemniteResult | IndemniteError {
  const {
    salaireBrutMensuel,
    dureePreavisSemaines,
    avantagesAnnuels,
    inclureAvantages,
    precompte,
    protectionSpeciale = "aucune",
  } = input;

  if (
    !Number.isFinite(salaireBrutMensuel) ||
    salaireBrutMensuel <= 0 ||
    salaireBrutMensuel > 100000
  ) {
    return {
      error:
        "Le salaire brut mensuel doit être supérieur à 0 € (et raisonnablement < 100 000 €).",
    };
  }

  if (
    !Number.isFinite(dureePreavisSemaines) ||
    dureePreavisSemaines < 0 ||
    dureePreavisSemaines > PREAVIS_MAX_SEMAINES
  ) {
    return {
      error: `La durée du préavis doit être comprise entre 0 et ${PREAVIS_MAX_SEMAINES} semaines.`,
    };
  }

  // Les avantages peuvent être ignorés explicitement.
  const avantagesValides =
    inclureAvantages &&
    Number.isFinite(avantagesAnnuels) &&
    avantagesAnnuels > 0
      ? avantagesAnnuels
      : 0;

  // 1. Rémunération mensuelle de base (salaire + part mensualisée des avantages).
  const remunerationMensuelle = salaireBrutMensuel + avantagesValides / 12;

  // 2. Rémunération hebdomadaire : formule légale 13 sem. = 3 mois.
  const remunerationHebdomadaire = (remunerationMensuelle * 3) / 13;

  // 3. Indemnité standard (préavis non presté).
  const indemniteBrute = remunerationHebdomadaire * dureePreavisSemaines;

  // 4. Indemnité de protection : mois × rémunération mensuelle.
  const moisProtection = PROTECTION_MOIS[protectionSpeciale];
  const indemniteProtectionSupplement = moisProtection * remunerationMensuelle;

  // 5. Total brut soumis au précompte.
  const indemniteTotalBrute = indemniteBrute + indemniteProtectionSupplement;

  // 6. Précompte spécial : taux selon brut annuel de référence.
  const brutAnnuel = salaireBrutMensuel * COEF_ANNUALISATION;
  const tauxPrecompte = tauxPrecompteSpecial(brutAnnuel);

  // 7. Net estimé (si demandé) sur le total brut.
  const indemniteNetEstimee = precompte
    ? indemniteTotalBrute * (1 - tauxPrecompte)
    : indemniteTotalBrute;

  // 8. Cotisation spéciale employeur (taux progressif selon brut annuel).
  //    Calculée sur l'indemnité de RUPTURE (sans la part protection :
  //    l'indemnité de protection est exclue des cotisations sociales,
  //    cf. ONSS 2026/1, notion de rémunération).
  //    Information employeur, n'affecte pas le net du salarié.
  const tauxCotisationSpeciale = tauxCotisationSpecialeProgressif(brutAnnuel);
  const cotisationSpecialeEmployeur = indemniteBrute * tauxCotisationSpeciale;

  return {
    remunerationMensuelle,
    remunerationHebdomadaire,
    indemniteBrute,
    indemniteProtectionSupplement,
    indemniteTotalBrute,
    indemniteNetEstimee,
    tauxPrecompteAppliquePourcent: tauxPrecompte * 100,
    cotisationSpecialeEmployeur,
    tauxCotisationSpecialePourcent: tauxCotisationSpeciale * 100,
    brutAnnuelReference: brutAnnuel,
    protectionSpeciale,
    preavisSemaines: dureePreavisSemaines,
  };
}
