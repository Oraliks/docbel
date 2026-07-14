// lib/bureaus/commune-search.ts
/** Normalise pour recherche : minuscule, sans accents, espaces compactés. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export interface CommuneLite {
  insCode: string
  nameFr: string
  nameNl?: string | null
  cp: string
}

/** Classe les communes dont le nom (FR ou NL) contient la requête normalisée.
 * Priorité : préfixe (0) avant sous-chaîne (1), puis ordre alphabétique FR. */
export function rankCommuneMatches(query: string, communes: CommuneLite[], limit = 8): CommuneLite[] {
  const q = normalizeForSearch(query)
  if (!q) return []
  const scored: { c: CommuneLite; score: number }[] = []
  for (const c of communes) {
    const fr = normalizeForSearch(c.nameFr)
    const nl = c.nameNl ? normalizeForSearch(c.nameNl) : ''
    let score = -1
    if (fr.startsWith(q) || (nl !== '' && nl.startsWith(q))) score = 0
    else if (fr.includes(q) || (nl !== '' && nl.includes(q))) score = 1
    if (score >= 0) scored.push({ c, score })
  }
  scored.sort((a, b) => a.score - b.score || a.c.nameFr.localeCompare(b.c.nameFr, 'fr'))
  return scored.slice(0, limit).map((s) => s.c)
}
