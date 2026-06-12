// Helpers de normalisation des données brutes Excel

const ERROR_PREFIX = '#'

/**
 * Parse une cellule contenant un nombre. Gère les formats belges :
 *  - séparateur décimal virgule ou point
 *  - séparateur des milliers (espace ou virgule en format US)
 *  - cellules d'erreur Excel (#REF!, #N/A, #DIV/0!, #VALUE!, #NAME?)
 *
 * Retourne `null` si la cellule est vide, une erreur formule ou non parsable.
 */
export function parseCellNumber(value: string | undefined | null): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (raw.startsWith(ERROR_PREFIX)) return null

  // Format Excel-US: 2,189.81 → 2189.81
  // Format Excel-BE: 2.189,81 ou 2189,81 → 2189.81
  let cleaned = raw

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  if (hasComma && hasDot) {
    // Le séparateur décimal est celui qui apparaît en dernier
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Format BE: 2.189,81 → 2189.81
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // Format US: 2,189.81 → 2189.81
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Soit décimal BE (62,0788), soit séparateur de milliers US sans décimales (2,189)
    // Heuristique : si exactement une virgule suivie de 1-4 chiffres, c'est décimal
    if (/^-?\d+,\d{1,4}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.')
    } else {
      // Sinon virgules = séparateurs de milliers
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  // Espaces (insécables ou normaux) comme séparateurs de milliers
  cleaned = cleaned.replace(/[\s ]/g, '')

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse une cellule contenant un code (entier).
 * Retourne null si la valeur n'est pas un entier strict.
 */
export function parseCellInteger(value: string | undefined | null): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  if (!/^-?\d+$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Normalise une cellule de code allocation (peut contenir plusieurs codes séparés par retour à la ligne).
 * Retourne la liste des codes individuels.
 *  Exemple : "AB\nAX" → ["AB", "AX"]
 *           "AA1"     → ["AA1"]
 *           ""        → []
 */
export function parseCodeCell(value: string | undefined | null): string[] {
  if (value == null) return []
  const raw = String(value).trim()
  if (!raw) return []
  return raw
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const UNIT_NORMALIZATION_MAP: Record<string, string> = {
  // NL → canonique
  maand: 'monthly',
  jaar: 'yearly',
  dag: 'daily',
  uur: 'hourly',
  // FR
  mois: 'monthly',
  an: 'yearly',
  année: 'yearly',
  annee: 'yearly',
  jour: 'daily',
  heure: 'hourly',
}

export function normalizeUnit(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const cleaned = String(raw).trim().toLowerCase()
  if (!cleaned) return null
  return UNIT_NORMALIZATION_MAP[cleaned] ?? cleaned
}

/**
 * Tente de parser une chaîne de date au format belge :
 *  "1/03/2026", "01/03/2026", "1-3-2026", "1/3/26", etc.
 * Retourne null si non parsable.
 */
export function parseBelgianDate(value: string | undefined | null): Date | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (!match) return null

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  let year = parseInt(match[3], 10)
  if (year < 100) year += 2000

  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  const d = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * Extrait une date de validité (validFrom) à partir d'un nom de fichier type
 * "barema-new-01042026.xlsx" ou "barema-01-04-2026.xlsx".
 *
 * Important : on exige un séparateur (- ou _) ou le début de chaîne juste
 * avant le groupe DDMMYYYY, ET l'extension `.xlsx` ou un séparateur juste
 * après. Sinon un timestamp epoch en tête de nom (ex: 1777763910366-…)
 * serait capté à tort comme une date.
 */
export function extractValidFromFileName(filename: string): Date | null {
  // Pattern DDMMYYYY isolé : (début|séparateur) puis 8 chiffres suivis de .xlsx,
  // d'un séparateur, ou d'un suffixe navigateur type " (1)" (re-téléchargement).
  const m1 = filename.match(/(?:^|[-_])(\d{2})(\d{2})(\d{4})(?=\.xlsx|[-_.\s(]|$)/i)
  if (m1) {
    const day = parseInt(m1[1], 10)
    const month = parseInt(m1[2], 10)
    const year = parseInt(m1[3], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1970) {
      const d = new Date(Date.UTC(year, month - 1, day))
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  // Pattern DD-MM-YYYY ou DD_MM_YYYY (séparateurs explicites)
  const m2 = filename.match(/(?:^|[-_])(\d{1,2})[-_](\d{1,2})[-_](\d{4})(?=\.xlsx|[-_.]|$)/i)
  if (m2) {
    return parseBelgianDate(`${m2[1]}/${m2[2]}/${m2[3]}`)
  }
  return null
}
