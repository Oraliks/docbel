// Codes ONEM volontairement ignorés pendant le parsing, avec raison explicite.
//
// Règle du module d'import : un code rencontré dans le fichier Excel doit être
// SOIT mappé dans code-mapping.ts (glossaire), SOIT déclaré ici avec une
// raison. Tout code absent des deux listes déclenche une issue 'unknown_code'
// dans le diagnostic admin — on ne devine jamais un mapping légal.
//
// Ajouter une entrée ici quand un code est identifié comme non pertinent pour
// la couche normalisée (en-tête décoratif, taux affiché, note de bas de page…).

import type { BaremeCategory } from './types'

export interface IgnoredCodeEntry {
  /** Raison humaine, affichée dans le diagnostic. */
  reason: string
  /** Limiter l'ignore à certaines catégories (sinon global). */
  categories?: BaremeCategory[]
}

/**
 * Codes (ou valeurs de cellule en position de code) volontairement ignorés.
 * Clé = valeur exacte après trim (insensible à la casse via isIgnoredCode).
 */
export const IGNORED_CODES: Record<string, IgnoredCodeEntry> = {
  // Lignes de taux affichées sous les codes dans les matrices (0.65 / 0.60) :
  // ce sont des pourcentages d'en-tête, pas des codes d'allocation.
  '0.65': { reason: "Taux d'indemnisation affiché en en-tête (65 %), pas un code d'allocation" },
  '0.6': { reason: "Taux d'indemnisation affiché en en-tête (60 %), pas un code d'allocation" },
  '0.60': { reason: "Taux d'indemnisation affiché en en-tête (60 %), pas un code d'allocation" },
  // Libellés de colonnes parfois alignés sur la ligne de codes
  CODE: { reason: 'Libellé d\'en-tête "Code", pas un code d\'allocation' },
}

/** Vrai si le code est volontairement ignoré (avec raison). */
export function isIgnoredCode(
  code: string,
  category?: BaremeCategory
): IgnoredCodeEntry | null {
  const cleaned = code.trim()
  if (!cleaned) return null
  const entry = IGNORED_CODES[cleaned] ?? IGNORED_CODES[cleaned.toUpperCase()]
  if (!entry) return null
  if (entry.categories && category && !entry.categories.includes(category)) return null
  return entry
}

/** Fichier à citer dans les recommandations du diagnostic. */
export const IGNORED_CODES_FILE = 'lib/baremes/ignored-codes.ts'
