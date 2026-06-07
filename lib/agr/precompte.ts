/**
 * Précompte professionnel sur l'AGR (feuille « Calcul PP » de l'Excel FGTB).
 *
 * Barème annuel de tranches appliqué au salaire imposable mensuel × 12, avec
 * un traitement particulier pour les chefs de ménage (catégorie A) : une part
 * du revenu est attribuée au conjoint puis imposée séparément.
 */

import type { PrecompteParams } from "./baremes";

/** Arrondi commercial à 2 décimales (équiv. Excel ROUND, demi vers le haut). */
function round2(x: number): number {
  return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
}

/** Impôt sur un revenu annuel net imposable `x` selon les tranches. */
function impot(x: number, p: PrecompteParams): number {
  if (x > p.plafond3) return round2((x - p.plafond3) * (p.pct4 / 100)) + p.fixe3;
  if (x > p.plafond2) return round2((x - p.plafond2) * (p.pct3 / 100)) + p.fixe2;
  if (x > p.plafond1) return round2((x - p.plafond1) * (p.pct2 / 100)) + p.fixe1;
  return round2(x * (p.pct1 / 100));
}

/**
 * Précompte professionnel mensuel sur un salaire imposable mensuel donné.
 *
 * @param imposableMensuel salaire imposable mensuel (D313 ou comp3 de 1B).
 * @param estChefDeMenage  true pour la catégorie familiale A (avec conjoint).
 */
export function precompteMensuel(
  imposableMensuel: number,
  estChefDeMenage: boolean,
  p: PrecompteParams,
): number {
  if (!imposableMensuel || imposableMensuel <= 0) return 0;

  const annuel = imposableMensuel * 12; // C
  const forfait =
    annuel > p.forfaitPlafond ? p.forfaitMax : round2(annuel * (p.forfaitPct / 100)); // D
  const netImposable = annuel - forfait; // E

  if (estChefDeMenage) {
    // Part attribuée au conjoint (F), plafonnée.
    const partConjoint = Math.min(
      round2(netImposable * (30 / 100)),
      p.maxIndemniteConjoint,
    );
    const impotConjoint = impot(partConjoint, p); // G
    const solde = netImposable - partConjoint; // H
    const impotSolde = impot(solde, p); // I
    const impotBase = impotConjoint + impotSolde; // J
    const reduit = Math.max(0, impotBase - 2 * p.diminutionBase); // K
    return round2(reduit / 12); // L
  }

  const impotBase = impot(netImposable, p); // M
  const reduit = Math.max(0, impotBase - p.diminutionBase); // N
  return round2(reduit / 12); // O
}
