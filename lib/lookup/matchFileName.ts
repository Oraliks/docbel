/**
 * Heuristique de matching nom de fichier ONEM → LookupTable.
 *
 * Les exports ONEM sont nommés : `<EntityName>-export_<lang>.csv`
 *   ex: SignaleticCompensationArticle-export_fr.csv
 *       TemporaryUnemploymentCause-export_fr.csv
 *       SignaleticShelteredWorkshop-export_fr.csv
 *
 * On découpe le nom CamelCase en mots, on normalise, et on score chaque table
 * sur le nombre de mots en commun avec son labelFr / labelNl / slug / prefix.
 */

export interface LookupTableInfo {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  exportName?: string | null
}

export interface MatchResult {
  fileName: string
  tableId: string | null
  confidence: number
  reason: string
}

/**
 * Extrait le nom interne ONEM depuis un nom de fichier export.
 *  "SignaleticCompensationArticle-export_fr.csv" → "SignaleticCompensationArticle"
 *  "BCPost-export_nl.csv" → "BCPost"
 */
export function extractOnemExportName(fileName: string): string {
  return fileName
    .replace(/\.(csv|txt)$/i, '')
    .replace(/-export_(fr|nl|de|en)$/i, '')
}

const STOP_WORDS = new Set([
  'de', 'du', 'le', 'la', 'les', 'des', 'au', 'aux', 'et', 'en', 'a', 'aan',
  'van', 'voor', 'op', 'in', 'list', 'export', 'fr', 'nl', 'de2', 'en2',
])

function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split CamelCase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
}

function scoreOverlap(a: string[], b: string[]): number {
  const setB = new Set(b)
  let common = 0
  for (const t of a) if (setB.has(t)) common++
  return common
}

/**
 * Pour un nom de fichier donné, trouve la meilleure table candidate parmi `tables`.
 * Retourne null avec confidence=0 si aucun match satisfaisant.
 *
 * Le score = nombre de mots en commun + bonus si le préfixe est inclus.
 * Un match avec confidence >= 2 est considéré comme suffisant.
 */
export function matchFileNameToTable(
  fileName: string,
  tables: LookupTableInfo[]
): MatchResult {
  const cleanName = extractOnemExportName(fileName)

  // 1. Match EXACT par exportName (priorité absolue)
  const exact = tables.find((t) => t.exportName && t.exportName === cleanName)
  if (exact) {
    return {
      fileName,
      tableId: exact.id,
      confidence: 99, // confiance maximale
      reason: `Match exact : ${exact.labelFr}`,
    }
  }

  // 2. Fallback : matching heuristique par tokens
  const fileTokens = tokenize(cleanName)
  if (fileTokens.length === 0) {
    return { fileName, tableId: null, confidence: 0, reason: 'Nom de fichier inexploitable' }
  }

  let best: { table: LookupTableInfo; score: number } | null = null
  for (const table of tables) {
    const tableTokens = [
      ...tokenize(table.labelFr),
      ...tokenize(table.labelNl),
      ...tokenize(table.slug),
      ...tokenize(table.prefix),
      ...(table.exportName ? tokenize(table.exportName) : []),
    ]
    let score = scoreOverlap(fileTokens, tableTokens)
    if (table.prefix && cleanName.toLowerCase().includes(table.prefix.toLowerCase())) {
      score += 1
    }
    if (!best || score > best.score) {
      best = { table, score }
    }
  }

  if (!best || best.score < 2) {
    return {
      fileName,
      tableId: null,
      confidence: best?.score ?? 0,
      reason: best
        ? `Heuristique : match faible (${best.score} mots — meilleur candidat: ${best.table.labelFr})`
        : 'Aucun match',
    }
  }

  return {
    fileName,
    tableId: best.table.id,
    confidence: best.score,
    reason: `Heuristique : ${best.table.labelFr}`,
  }
}

export function matchAllFileNames(
  fileNames: string[],
  tables: LookupTableInfo[]
): MatchResult[] {
  return fileNames.map((name) => matchFileNameToTable(name, tables))
}
