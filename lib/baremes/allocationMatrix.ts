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
