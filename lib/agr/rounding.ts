/**
 * Helpers d'arrondi reproduisant fidèlement les conventions de l'Excel FGTB
 * « Calcul AGR » (feuille `calcul 0104xx`).
 *
 * L'Excel n'utilise pas un arrondi standard : il combine TRUNC + FIXED + RIGHT
 * pour inspecter des décimales précises et décider du sens d'arrondi. On
 * reproduit ces gestes exactement, sinon les montants divergent au centime.
 *
 * Quatre conventions distinctes apparaissent dans le classeur :
 *  - « arrondi A » : troncature à 4 décimales (TRUNC(x;4)).
 *  - « arrondi B » : arrondi commercial à 2 décimales (3ᵉ décimale ≥ 5 → +0,01).
 *  - « arrondi D » : arrondi « au centime supérieur » dès qu'il reste une
 *                    fraction au-delà de la 2ᵉ décimale (plafond au centime).
 *  - conversion heures → jours : arrondi au demi-jour (seuils .25 / .75).
 */

/**
 * Troncature vers zéro à `n` décimales (équiv. Excel TRUNC).
 *
 * On nettoie le bruit IEEE-754 via `toPrecision(12)` avant la troncature :
 * sans cela `17.6142 * 10000` vaut `176141.99999…` et tronquerait à `17.6141`.
 */
export function truncN(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** n;
  const scaled = Number((x * f).toPrecision(12));
  return Math.trunc(scaled) / f;
}

/** Nettoie un flottant en l'arrondissant à `n` décimales (anti bruit IEEE-754). */
export function cleanFloat(x: number, n = 2): number {
  const f = 10 ** n;
  return Math.round((x + (x >= 0 ? 1 : -1) * 1e-9) * f) / f;
}

/**
 * Renvoie l'entier formé des `count` derniers chiffres de `x` formaté à
 * `totalDecimals` décimales — reproduit `VALUE(RIGHT(FIXED(x;d);count))`.
 *
 * `x` est supposé déjà tronqué à `totalDecimals` décimales par l'appelant.
 */
function lastDigits(x: number, totalDecimals: number, count: number): number {
  const s = Math.abs(x).toFixed(totalDecimals);
  return parseInt(s.slice(-count), 10) || 0;
}

/** « arrondi A » : troncature à 4 décimales. */
export function arrondiA(x: number): number {
  return truncN(x, 4);
}

/**
 * « arrondi B » : arrondi commercial à 2 décimales.
 * Tronque à 3 décimales, puis arrondit vers le haut si la 3ᵉ décimale ≥ 5.
 */
export function arrondiB(x: number): number {
  const j = truncN(x, 3);
  const third = lastDigits(j, 3, 1);
  const base = truncN(j, 2);
  return third > 4 ? cleanFloat(base + 0.01, 2) : base;
}

/**
 * « arrondi D » : plafond au centime. Tronque à 4 décimales puis arrondit au
 * centime supérieur dès qu'une des 3ᵉ/4ᵉ décimales est non nulle.
 */
export function arrondiD(x: number): number {
  const j = truncN(x, 4);
  const frac34 = lastDigits(j, 4, 2);
  const base = truncN(j, 2);
  return frac34 > 0 ? cleanFloat(base + 0.01, 2) : base;
}

/**
 * Conversion d'un nombre d'heures (déjà divisé : h × 6 / facteur) en jours
 * indemnisables, arrondi au demi-jour :
 *  - partie décimale 0,00–0,24 → jour entier (plancher) ;
 *  - 0,25–0,74 → demi-jour (x,5) ;
 *  - 0,75–0,99 → jour supérieur (plafond).
 */
export function joursRound(x: number): number {
  const j = truncN(x, 2);
  const cents = lastDigits(j, 2, 2);
  const whole = Math.trunc(j);
  if (cents > 74) return whole + 1;
  if (cents > 24) return whole + 0.5;
  return whole;
}
