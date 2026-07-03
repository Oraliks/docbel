/**
 * Détection d'intention dans une requête de recherche du corpus.
 *
 * Au guichet, 9 requêtes sur 10 sont un numéro d'article que le conseiller
 * connaît déjà (« art. 79 », « 131bis », « am 75ter »). On extrait ce numéro
 * (+ éventuelle nature AR/AM) pour épingler la fiche exacte en tête des
 * résultats — corrige le défaut de ranking connu (art. 79 mal classé).
 *
 * 100 % pur, testé unitairement.
 */

const LATIN =
  "bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies|undecies|duodecies";
const NUM = `\\d+(?:${LATIN})?(?:/\\d+)?`;

export interface QueryIntent {
  /** Numéro d'article détecté (minuscule, ex. « 131bis ») ou null. */
  articleNumber: string | null;
  /** Nature explicitement mentionnée (AR|AM|Loi-programme) ou null. */
  nature: string | null;
}

export function parseQueryIntent(q: string): QueryIntent {
  const s = (q ?? "").trim();
  if (!s) return { articleNumber: null, nature: null };

  let nature: string | null = null;
  if (/\bloi-programme\b/i.test(s)) nature = "Loi-programme";
  else if (/\bAR\b/i.test(s) || /arrêté royal/i.test(s)) nature = "AR";
  else if (/\bAM\b/i.test(s) || /arrêté ministériel/i.test(s)) nature = "AM";

  // « art. 79 » / « article 131bis »
  const withKeyword = new RegExp(`\\b(?:art\\.?|articles?)\\s*(${NUM})`, "i").exec(s);
  // « 79bis » ou « am 75ter » (numéro nu, éventuellement précédé d'une nature)
  const stripped = s.replace(/^\s*(?:AR|AM|Loi-programme|Loi)\s+/i, "");
  const bareNumber = new RegExp(`^\\s*(${NUM})\\s*$`, "i").exec(stripped);
  const m = withKeyword ?? bareNumber;
  const articleNumber = m ? m[1].toLowerCase() : null;

  return { articleNumber, nature };
}
