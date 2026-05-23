import type { ResultGroup, SearchResult } from './types'

/**
 * Groupe les résultats par table source, triés par meilleur score décroissant
 * (la table la plus pertinente apparaît en haut).
 */
export function groupResultsByTable(results: SearchResult[]): ResultGroup[] {
  const map = new Map<string, ResultGroup>()
  for (const r of results) {
    const existing = map.get(r.table.slug)
    if (!existing) {
      map.set(r.table.slug, {
        tableSlug: r.table.slug,
        tableLabel: r.table.labelFr,
        tablePrefix: r.table.prefix,
        categoryLabel: r.table.category.labelFr,
        topScore: r.similarity,
        rows: [r],
      })
    } else {
      existing.rows.push(r)
      if (r.similarity > existing.topScore) existing.topScore = r.similarity
    }
  }
  return [...map.values()].sort((a, b) => b.topScore - a.topScore)
}
