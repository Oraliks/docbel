// Mapping des codes ONEM → sémantique (situation familiale, période, libellés).
//
// Source de vérité : lib/data/baremes-codes-glossary.json (maintenu à la main,
// enrichi au fil des clarifications ONEM). Ce module l'expose de façon typée
// aux parsers pour :
//   1. reconnaître un code ("mappé") et enrichir la trace de la ligne ;
//   2. détecter les codes inconnus → issue 'unknown_code' avec recommandation.
//
// Un code rencontré dans le fichier Excel doit être SOIT présent ici, SOIT
// déclaré dans ignored-codes.ts avec une raison. Jamais deviné.

import glossary from '@/lib/data/baremes-codes-glossary.json'
import type { BaremeCategory } from './types'

export interface CodeInfo {
  code: string
  /** Libellé FR (peut contenir "TODO" si la sémantique est à confirmer). */
  labelFr: string | null
  labelNl?: string | null
  /** Situation familiale A/N/B si applicable. */
  situation?: string | null
  situationLabelFr?: string | null
  /** Période d'indemnisation (1 ou 2) si applicable. */
  period?: number | null
  /** Phase de la 1ère période (1/2/3) si applicable. */
  phase?: number | null
  /** Taux appliqué (0.65, 0.60…) si connu. */
  rate?: number | null
  /** Section du glossaire d'où vient le mapping. */
  glossarySection: string
}

interface GlossaryEntry {
  fr?: string
  nl?: string
  situation?: string
  period?: number
  phase?: number
  rate?: number
  [key: string]: unknown
}

type GlossarySection = Record<string, GlossaryEntry>

const G = glossary as unknown as Record<string, unknown>

function section(name: string): GlossarySection {
  const s = G[name]
  if (!s || typeof s !== 'object') return {}
  // Les clés préfixées par _ sont des métadonnées (_meta, _suffixes…)
  const out: GlossarySection = {}
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (k.startsWith('_')) continue
    if (v && typeof v === 'object') out[k] = v as GlossaryEntry
  }
  return out
}

const FULL_CODES = section('fullCodes')
const TEMP_CODES = section('tempUnemploymentCodes')
const SPECCAT_CODES = section('specCatCodes')
const ALLOCATION_W_CODES = section('allocationWCodes')
const FAMILY_SITUATIONS = section('familySituations')

/** Sections du glossaire interrogées pour chaque catégorie de feuille. */
const CATEGORY_SECTIONS: Partial<Record<BaremeCategory, { name: string; codes: GlossarySection }[]>> = {
  full_unemployment: [{ name: 'fullCodes', codes: FULL_CODES }],
  half_unemployment: [{ name: 'fullCodes', codes: FULL_CODES }],
  temporary_unemployment_full: [
    { name: 'tempUnemploymentCodes', codes: TEMP_CODES },
    { name: 'fullCodes', codes: FULL_CODES },
  ],
  temporary_unemployment_half: [
    { name: 'tempUnemploymentCodes', codes: TEMP_CODES },
    { name: 'fullCodes', codes: FULL_CODES },
  ],
  special_category_full: [
    { name: 'specCatCodes', codes: SPECCAT_CODES },
    { name: 'fullCodes', codes: FULL_CODES },
  ],
  special_category_half: [
    { name: 'specCatCodes', codes: SPECCAT_CODES },
    { name: 'fullCodes', codes: FULL_CODES },
  ],
  allocation_w: [{ name: 'allocationWCodes', codes: ALLOCATION_W_CODES }],
}

function entryToInfo(code: string, entry: GlossaryEntry, sectionName: string): CodeInfo {
  const situation = typeof entry.situation === 'string' ? entry.situation : null
  const situationEntry = situation ? FAMILY_SITUATIONS[situation] : undefined
  return {
    code,
    labelFr: typeof entry.fr === 'string' ? entry.fr : null,
    labelNl: typeof entry.nl === 'string' ? entry.nl : null,
    situation,
    situationLabelFr: situationEntry?.fr ?? null,
    period: typeof entry.period === 'number' ? entry.period : null,
    phase: typeof entry.phase === 'number' ? entry.phase : null,
    rate: typeof entry.rate === 'number' ? entry.rate : null,
    glossarySection: sectionName,
  }
}

/**
 * Résout la sémantique d'un code ONEM pour une catégorie de feuille donnée.
 * Retourne null si le code est absent du glossaire (→ code inconnu).
 */
export function resolveCodeInfo(
  code: string,
  category: BaremeCategory
): CodeInfo | null {
  const cleaned = code.trim()
  if (!cleaned) return null

  const sections = CATEGORY_SECTIONS[category]
  if (!sections) return null // catégorie sans codes d'allocation (tranches, montants de base…)

  for (const { name, codes } of sections) {
    const entry = codes[cleaned]
    if (entry) return entryToInfo(cleaned, entry, name)
  }

  // Codes W composés (ex: "WA2V") : préfixe lettre connue de la section W
  if (category === 'allocation_w' && cleaned.length > 1) {
    const base = cleaned[0]
    const entry = ALLOCATION_W_CODES[base]
    if (entry) {
      const info = entryToInfo(cleaned, entry, 'allocationWCodes')
      return { ...info, labelFr: info.labelFr ? `${info.labelFr} (variante ${cleaned})` : null }
    }
  }

  return null
}

/** Vrai si le code est mappé dans le glossaire pour cette catégorie. */
export function isKnownCode(code: string, category: BaremeCategory): boolean {
  return resolveCodeInfo(code, category) !== null
}

/** Vrai si la catégorie attend des codes d'allocation (sinon pas de check unknown_code). */
export function categoryHasCodeMapping(category: BaremeCategory): boolean {
  return category in CATEGORY_SECTIONS
}

/** Fichier à citer dans les recommandations et les traces. */
export const CODE_MAPPING_FILE = 'lib/baremes/code-mapping.ts'
export const CODE_GLOSSARY_FILE = 'lib/data/baremes-codes-glossary.json'
