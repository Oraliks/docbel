// lib/bureaus/search-classifier.ts
export type SearchIntent = 'empty' | 'postal_code' | 'address' | 'text'

/** Indices de voie (FR + NL) pour repérer une adresse/rue. */
const STREET_HINTS =
  /(^|\s)(rue|avenue|av|chauss[eé]e|bd|boulevard|place|pl|square|clos|impasse|route|chemin|quai|all[eé]e|galerie|straat|laan|steenweg|weg|plein|dreef|markt|kaai|baan)(\s|$)/i

/**
 * Classe une requête en intention. Heuristique LOCALE et coarse : le
 * matching précis commune/organisme/bureau/service se fait côté serveur
 * (`/api/bureaux/suggest`). Sert surtout à décider s'il faut aussi
 * interroger le géocodeur d'adresses.
 */
export function classifyQuery(raw: string): SearchIntent {
  const q = raw.trim()
  if (!q) return 'empty'
  if (/^\d{4}$/.test(q)) return 'postal_code'
  const hasDigit = /\d/.test(q)
  const hasLetters = /[a-zà-ÿ]{2,}/i.test(q)
  const hasComma = q.includes(',')
  const hasStreetHint = STREET_HINTS.test(q)
  // Adresse probable : indice de voie, OU (chiffre + virgule + lettres),
  // OU (chiffre + lettres + longueur suffisante) — ex. "avenue Louise 143".
  if (hasStreetHint || (hasDigit && hasComma && hasLetters) || (hasDigit && hasLetters && q.length >= 8)) {
    return 'address'
  }
  return 'text'
}
