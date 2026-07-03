/**
 * Helpers autour d'un texte de loi (« AR 25/11/1991 ») : slug d'URL stable et
 * tri naturel par numéro d'article (« 79 » < « 79bis » < « 104 »). Purs, testés.
 */

/** « AR 25/11/1991 » → « ar-25-11-1991 » (slug d'URL réversible par recherche). */
export function slugifyLoi(loi: string): string {
  return (loi ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // ôte les diacritiques
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Préfixe numérique d'un n° d'article (« 131bis » → 131) pour le tri. */
export function articleNumericPrefix(articleNumber: string): number {
  const m = /^(\d+)/.exec(articleNumber ?? "");
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

/** Comparateur d'articles : partie numérique puis ordre lexical (bis/ter…). */
export function compareArticles(
  a: { articleNumber: string; riolexId: string },
  b: { articleNumber: string; riolexId: string },
): number {
  const na = articleNumericPrefix(a.articleNumber);
  const nb = articleNumericPrefix(b.articleNumber);
  if (na !== nb) return na - nb;
  return a.articleNumber.localeCompare(b.articleNumber, "fr", { numeric: true });
}
