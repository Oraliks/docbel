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
 * "spécial" cumulé, proche du taux marginal du bénéficiaire. Pour une
 * estimation rapide, on retient ~33,28 % (taux moyen souvent observé,
 * cf. fiches SPF Finances pour les indemnités de dédit). C'est volontairement
 * une approximation : le taux réel dépend du revenu annuel global.
 *
 * Ce fichier est de la logique pure : pas de React, pas de side-effects.
 */

/** Taux moyen de précompte spécial sur indemnité de rupture (estimation). */
const PRECOMPTE_SPECIAL = 0.3328;

/** Garde-fou : un préavis raisonnable ne dépasse pas ~4 ans (200 semaines). */
const PREAVIS_MAX_SEMAINES = 200;

export interface IndemniteInput {
  salaireBrutMensuel: number;
  dureePreavisSemaines: number;
  avantagesAnnuels: number;
  inclureAvantages: boolean;
  precompte: boolean;
}

export interface IndemniteResult {
  remunerationMensuelle: number;
  remunerationHebdomadaire: number;
  indemniteBrute: number;
  indemniteNetEstimee: number;
  preavisSemaines: number;
}

export interface IndemniteError {
  error: string;
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

  // 3. Indemnité brute = hebdo × nb semaines de préavis non presté.
  const indemniteBrute = remunerationHebdomadaire * dureePreavisSemaines;

  // 4. Net estimé après précompte spécial (si demandé).
  //    Sans précompte demandé, on renvoie le brut pour ne pas tromper.
  const indemniteNetEstimee = precompte
    ? indemniteBrute * (1 - PRECOMPTE_SPECIAL)
    : indemniteBrute;

  return {
    remunerationMensuelle,
    remunerationHebdomadaire,
    indemniteBrute,
    indemniteNetEstimee,
    preavisSemaines: dureePreavisSemaines,
  };
}
