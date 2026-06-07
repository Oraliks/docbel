/**
 * Dérivation de la catégorie du travailleur (1O/1E/2E/2P/3) à partir de la
 * catégorie employeur (ONSS) et du code travailleur.
 *
 * Portage de la feuille Excel « Catégorie travailleur ». Logique :
 *  - certaines catégories employeur indiquent le secteur public (régime 2) ;
 *  - le 1ᵉʳ chiffre du code travailleur (si ≥ 100) distingue ouvrier/employé ;
 *  - quelques codes employeur dénotent un statutaire (régime 3).
 */

import type { CategorieTravailleur } from "./types";

/** Catégories employeur du secteur public (L7 dans l'Excel). */
const CAT_PUBLIC_A = new Set([
  1, 40, 42, 45, 46, 47, 50, 75, 96, 101, 134, 140, 145, 150, 175, 196, 245,
  246, 351, 396, 411, 437, 440, 441, 445, 496, 497, 599, 951, 952, 750, 751,
]);
/** Autres catégories employeur du secteur public (L8). */
const CAT_PUBLIC_B = new Set([
  146, 272, 296, 346, 347, 350, 372, 399, 958, 959, 981, 982, 752, 753, 772,
]);
/** Catégories employeur statutaires (L9). */
const CAT_STATUTAIRE = new Set([953, 954, 955, 956, 957]);

/**
 * @param categorieEmployeur catégorie ONSS (ex. "751").
 * @param codeTravailleur    code travailleur (ex. "015", "761").
 * @returns la catégorie travailleur, ou null si le code est en erreur.
 */
export function deriverCategorieTravailleur(
  categorieEmployeur: string | number,
  codeTravailleur: string | number,
): CategorieTravailleur | null {
  const cat = typeof categorieEmployeur === "number" ? categorieEmployeur : parseInt(categorieEmployeur, 10);
  const code = typeof codeTravailleur === "number" ? codeTravailleur : parseInt(codeTravailleur, 10);
  if (!Number.isFinite(cat) || !Number.isFinite(code)) return null;

  // J9 : 1ᵉʳ chiffre du code travailleur si ≥ 100, sinon 0.
  const j9 = code > 99 ? parseInt(String(code)[0], 10) : 0;

  // N7 : régime employeur (1 = privé, 2 = public, 3 = statutaire).
  const estPublic = CAT_PUBLIC_A.has(cat) || CAT_PUBLIC_B.has(cat);
  const estStatutaire = CAT_STATUTAIRE.has(cat) || j9 === 6;
  const n7 = estPublic ? 2 : estStatutaire ? 3 : 1;

  // Codes en erreur (O23/O24) : 1ᵉʳ chiffre 3 ou 5.
  if (j9 === 5 || j9 === 3) return null;

  // Secteur privé (régime 1).
  if (n7 === 1) {
    if (code < 100) return "1O"; // O7 : ouvrier privé
    if (j9 > 1) return "1E"; // O8 : employé privé
    if (j9 === 1) return "1O"; // O6/O22 : ouvrier privé
    return null;
  }

  // Statutaire (régime 3).
  if (estStatutaire) return "3"; // O9

  // Secteur public contractuel (régime 2).
  // Employé public (O20) : J9 ∈ {2,4}, code 732, codes 761/741.
  if (j9 === 2 || j9 === 4 || code === 732 || code === 761 || code === 741) return "2E";
  // Ouvrier public (O21) : code < 100, J9 = 1, code 731.
  if (code < 100 || j9 === 1 || code === 731) return "2P";
  return null;
}
