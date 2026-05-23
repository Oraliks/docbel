import type { ReactNode } from 'react'

/**
 * Construit une fonction qui surligne en `<mark>` les occurrences de `query`
 * dans une chaîne. Renvoie l'identité si la query est trop courte.
 */
export function makeHighlighter(query: string): (s: string) => ReactNode {
  if (!query || query.length < 2) return (s) => s
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')
  return (s) => {
    if (!s) return s
    return s.split(re).map((part, i) =>
      re.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-700/60 dark:text-yellow-50 px-0.5"
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    )
  }
}
