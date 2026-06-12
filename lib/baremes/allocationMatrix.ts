// Construction de la matrice d'allocations (code × tranche salariale) pour les
// pages de consultation publiques. Pivote les ActiveBaremeAmount d'une catégorie
// matricielle (full_unemployment, half_unemployment) en groupes de colonnes par
// situation familiale + lignes par tranche.

import type { ActiveBaremeAmount } from './getActiveBaremeData'
import { resolveCodeInfo } from './code-mapping'
import type { BaremeCategory } from './types'

export interface MatrixColumn {
  key: string
  label: string
  /** Codes ONEM regroupés dans cette colonne (ex: ['AB','AX'] fusionnés). */
  codes: string[]
  /** Taux affiché sous le code (ex: "65 %"), null si 2ème période. */
  rate: string | null
  /** Sous-libellé (ex: "BV+ / PP+" pour BX). */
  sub: string | null
}

export interface MatrixGroup {
  key: string
  label: string
  sublabel: string
  /** Clé d'accent visuel : 'a' charge de famille, 'n' isolé, 'b'/'b2' cohabitant. */
  accent: 'a' | 'n' | 'b' | 'b2'
  columns: MatrixColumn[]
}

export interface MatrixRow {
  tranche: string
  isMin: boolean
  /** Montants alignés sur l'ordre plat des colonnes (columnKeys). */
  values: (number | null)[]
}

export interface AllocationMatrixData {
  eyebrow: string
  title: string
  titleAccent: string
  subtitleNl: string
  validFrom: string | null
  multiplicateur: number | null
  unitLabel: string
  groups: MatrixGroup[]
  columnKeys: string[]
  rows: MatrixRow[]
  trancheCodes: string[]
  /** Note d'avertissement affichée en bandeau (ex: libellés en cours de complétion). */
  note?: string | null
}

interface ColumnSpec {
  codes: string[]
  label?: string
  sub?: string | null
}
interface GroupSpec {
  key: string
  label: string
  sublabel: string
  accent: MatrixGroup['accent']
  columns: ColumnSpec[]
}

/**
 * Layout des feuilles A_N_B (chômage complet plein temps et mi-temps) : 15 codes
 * regroupés par situation. AB/AX et NB/NX sont fusionnés (valeurs identiques) ;
 * la 2ème période cohabitant (BX/BB) forme un groupe distinct (privilégié ou non).
 */
const ANB_LAYOUT: GroupSpec[] = [
  {
    key: 'A',
    label: 'Charge de famille',
    sublabel: 'Travailleurs · 1ʳᵉ & 2ᵉ période',
    accent: 'a',
    columns: [
      { codes: ['AA1'] },
      { codes: ['AA2'] },
      { codes: ['AA3'] },
      { codes: ['AB', 'AX'], label: 'AB / AX' },
    ],
  },
  {
    key: 'N',
    label: 'Isolés',
    sublabel: 'Alleenwonenden · 1ʳᵉ & 2ᵉ période',
    accent: 'n',
    columns: [
      { codes: ['NA1'] },
      { codes: ['NA2'] },
      { codes: ['NA3'] },
      { codes: ['NB', 'NX'], label: 'NB / NX' },
    ],
  },
  {
    key: 'B',
    label: 'Cohabitants',
    sublabel: 'Samenwonenden · 1ʳᵉ période',
    accent: 'b',
    columns: [{ codes: ['BA1'] }, { codes: ['BA2'] }, { codes: ['BA3'] }],
  },
  {
    key: 'B2',
    label: '2ᵉ période',
    sublabel: 'Cohabitants',
    accent: 'b2',
    columns: [
      { codes: ['BX'], sub: 'BV+ / PP+' },
      { codes: ['BB'], sub: 'BV- / PP-' },
    ],
  },
]

const ANB_META: Record<string, { eyebrow: string; title: string; titleAccent: string; subtitleNl: string }> = {
  full_unemployment: {
    eyebrow: 'Allocations de chômage complet',
    title: "Montant journalier de l'allocation",
    titleAccent: 'entière',
    subtitleNl: 'Volledige werkloosheidsuitkeringen — dagbedrag',
  },
  half_unemployment: {
    eyebrow: 'Allocations de chômage complet',
    title: "Montant journalier de l'allocation",
    titleAccent: 'mi-temps',
    subtitleNl: 'Halve werkloosheidsuitkeringen — dagbedrag',
  },
}

function formatRate(rate: number | null | undefined): string | null {
  if (rate == null) return null
  return `${Math.round(rate * 100)} %`
}

const FLAT_ACCENTS: MatrixGroup['accent'][] = ['a', 'n', 'b', 'b2']

/** Sépare le code de base et l'index de variante depuis "A0 N0 B0@2". */
function splitVariant(codeVariant: string): { base: string; variant: number } {
  const m = codeVariant.match(/^(.*?)@(\d+)$/)
  if (m) return { base: m[1], variant: Number(m[2]) }
  return { base: codeVariant, variant: 1 }
}

/** Extrait la partie code+variante d'une comparisonKey (avant la dernière `:`). */
function codeVariantFromKey(comparisonKey: string, category: string): string | null {
  const prefix = `${category}:`
  if (!comparisonKey.startsWith(prefix)) return null
  const rest = comparisonKey.slice(prefix.length)
  const last = rest.lastIndexOf(':')
  return last === -1 ? null : rest.slice(0, last)
}

const FLAT_META: Record<string, { eyebrow: string; title: string; titleAccent: string; subtitleNl: string }> = {
  temporary_unemployment_full: {
    eyebrow: 'Chômage temporaire',
    title: "Montant journalier de l'allocation",
    titleAccent: 'temporaire',
    subtitleNl: 'Tijdelijke werkloosheidsuitkeringen — dagbedrag',
  },
  special_category_full: {
    eyebrow: 'Catégories spéciales',
    title: 'Montant journalier',
    titleAccent: 'par catégorie',
    subtitleNl: 'Bijzondere categorieën — dagbedrag',
  },
}

/**
 * Construit une matrice « codes plats » (chômage temporaire, catégories
 * spéciales) : un groupe par code de base, une colonne par variante de taux.
 * Les valeurs sont indexées par la comparisonKey (qui porte le suffixe @N).
 */
export function buildFlatMatrix(
  amounts: ActiveBaremeAmount[],
  category: BaremeCategory,
  multiplicateur: number | null
): AllocationMatrixData | null {
  if (!amounts.length) return null

  const byKey = new Map<string, number>()
  const trancheSet = new Set<string>()
  // codeVariant → { base, variant, rate }
  const variants = new Map<string, { base: string; variant: number; rate: number | null }>()
  let validFrom: string | null = null

  for (const a of amounts) {
    const cv = codeVariantFromKey(a.comparisonKey, category)
    if (!cv || !a.salaryCode) continue
    byKey.set(`${cv}:${a.salaryCode}`, a.amount)
    trancheSet.add(a.salaryCode)
    if (!variants.has(cv)) {
      const { base, variant } = splitVariant(cv)
      variants.set(cv, { base, variant, rate: a.rate })
    }
    if (!validFrom && a.validFrom) validFrom = a.validFrom.toISOString().slice(0, 10)
  }

  // Ordre des bases = première apparition ; variantes triées par index.
  const baseOrder: string[] = []
  for (const { base } of variants.values()) if (!baseOrder.includes(base)) baseOrder.push(base)

  let hasUnlabeledVariant = false
  const groups: MatrixGroup[] = baseOrder.map((base, i) => {
    const entries = [...variants.entries()]
      .filter(([, v]) => v.base === base)
      .sort((a, b) => a[1].variant - b[1].variant)
    const multi = entries.length > 1
    const cols = entries.map(([cv, v]) => {
      // Libellé de colonne : le taux si connu, sinon "Variante N" (honnête —
      // la sémantique fine de ces feuilles est encore à documenter au glossaire).
      const rateLabel = formatRate(v.rate)
      if (multi && !rateLabel) hasUnlabeledVariant = true
      return {
        key: cv,
        label: multi ? (rateLabel ?? `Variante ${v.variant}`) : base,
        codes: [cv],
        rate: null,
        sub: null,
      }
    })
    return {
      key: base,
      label: base,
      sublabel: multi ? `${entries.length} variantes` : '',
      accent: FLAT_ACCENTS[i % FLAT_ACCENTS.length],
      columns: cols,
    }
  })

  const flatColumns = groups.flatMap((g) => g.columns)
  const numeric = [...trancheSet].filter((t) => /^\d+$/.test(t)).map(Number).sort((a, b) => a - b)
  const trancheCodes = [
    ...(trancheSet.has('MIN') ? ['MIN'] : []),
    ...numeric.map(String),
    ...(trancheSet.has('MAX') ? ['MAX'] : []),
  ]
  const rows: MatrixRow[] = trancheCodes.map((tranche) => ({
    tranche,
    isMin: tranche === 'MIN',
    values: flatColumns.map((col) => byKey.get(`${col.codes[0]}:${tranche}`) ?? null),
  }))

  const meta = FLAT_META[category] ?? {
    eyebrow: 'Barème',
    title: 'Montants',
    titleAccent: '',
    subtitleNl: '',
  }

  return {
    ...meta,
    validFrom,
    multiplicateur,
    unitLabel: 'Montants en € · par jour',
    groups,
    columnKeys: flatColumns.map((c) => c.key),
    rows,
    trancheCodes,
    note: hasUnlabeledVariant
      ? 'Libellés des variantes en cours de complétion (glossaire ONEM) — les montants affichés sont exacts.'
      : null,
  }
}

/**
 * Construit la matrice des salaires horaires : lignes = code de tranche,
 * colonnes = régime horaire (heures/semaine, extrait de la comparisonKey
 * "hourly_wage:CODE:HEURES").
 */
export function buildHourlyMatrix(
  amounts: ActiveBaremeAmount[],
  multiplicateur: number | null
): AllocationMatrixData | null {
  if (!amounts.length) return null

  const byKey = new Map<string, number>()
  const hoursSet = new Set<string>()
  const trancheSet = new Set<string>()
  let validFrom: string | null = null

  for (const a of amounts) {
    if (!a.salaryCode) continue
    const parts = a.comparisonKey.split(':')
    const hours = parts[parts.length - 1]
    if (!hours) continue
    byKey.set(`${a.salaryCode}:${hours}`, a.amount)
    hoursSet.add(hours)
    trancheSet.add(a.salaryCode)
    if (!validFrom && a.validFrom) validFrom = a.validFrom.toISOString().slice(0, 10)
  }

  // Colonnes = heures décroissantes (40, 39.5, 39…)
  const hours = [...hoursSet].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => b - a)
  const columns: MatrixColumn[] = hours.map((h) => ({
    key: String(h),
    label: `${h.toLocaleString('fr-BE')} h`,
    codes: [String(h)],
    rate: null,
    sub: 'par semaine',
  }))
  const groups: MatrixGroup[] = [
    { key: 'hours', label: 'Régime horaire', sublabel: 'Heures par semaine', accent: 'a', columns },
  ]

  const tranches = [...trancheSet].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b)
  const trancheCodes = tranches.map(String)
  const rows: MatrixRow[] = trancheCodes.map((tranche) => ({
    tranche,
    isMin: false,
    values: columns.map((col) => byKey.get(`${tranche}:${col.codes[0]}`) ?? null),
  }))

  return {
    eyebrow: 'Salaires horaires',
    title: 'Salaire horaire de référence',
    titleAccent: 'par régime',
    subtitleNl: 'Uurlonen — referteloon',
    validFrom,
    multiplicateur,
    unitLabel: 'Salaires en € · par heure',
    groups,
    columnKeys: columns.map((c) => c.key),
    rows,
    trancheCodes,
  }
}

/**
 * Construit la matrice d'une catégorie A_N_B à partir des montants publiés.
 * Retourne null si aucun montant.
 */
export function buildAnbMatrix(
  amounts: ActiveBaremeAmount[],
  category: BaremeCategory,
  multiplicateur: number | null
): AllocationMatrixData | null {
  if (!amounts.length) return null

  // Index (code, tranche) → montant
  const byCodeTranche = new Map<string, number>()
  const trancheSet = new Set<string>()
  let validFrom: string | null = null
  for (const a of amounts) {
    if (!a.allocationCode || !a.salaryCode) continue
    byCodeTranche.set(`${a.allocationCode}:${a.salaryCode}`, a.amount)
    trancheSet.add(a.salaryCode)
    if (!validFrom && a.validFrom) validFrom = a.validFrom.toISOString().slice(0, 10)
  }

  // Colonnes : résout le taux depuis le glossaire
  const groups: MatrixGroup[] = ANB_LAYOUT.map((g) => ({
    key: g.key,
    label: g.label,
    sublabel: g.sublabel,
    accent: g.accent,
    columns: g.columns.map((c) => {
      const info = resolveCodeInfo(c.codes[0], category)
      return {
        key: c.codes.join('+'),
        label: c.label ?? c.codes[0],
        codes: c.codes,
        rate: formatRate(info?.rate),
        sub: c.sub ?? null,
      }
    }),
  }))

  const flatColumns = groups.flatMap((g) => g.columns)
  const columnKeys = flatColumns.map((c) => c.key)

  // Lignes : MIN puis tranches numériques croissantes
  const numeric = [...trancheSet].filter((t) => /^\d+$/.test(t)).map(Number).sort((a, b) => a - b)
  const trancheCodes = [
    ...(trancheSet.has('MIN') ? ['MIN'] : []),
    ...numeric.map(String),
    ...(trancheSet.has('MAX') ? ['MAX'] : []),
  ]

  const rows: MatrixRow[] = trancheCodes.map((tranche) => ({
    tranche,
    isMin: tranche === 'MIN',
    values: flatColumns.map((col) => byCodeTranche.get(`${col.codes[0]}:${tranche}`) ?? null),
  }))

  const meta = ANB_META[category] ?? ANB_META.full_unemployment

  return {
    ...meta,
    validFrom,
    multiplicateur,
    unitLabel: 'Montants en € · par jour',
    groups,
    columnKeys,
    rows,
    trancheCodes,
  }
}
