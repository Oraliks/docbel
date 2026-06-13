import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, BaremeIgnoredRow } from './types'
import { cellRef, makeIssue } from './types'
import { parseCellNumber } from './normalize'

/**
 * Couverture inverse : pour les feuilles DENSES (1 cellule = 1 montant), vérifie
 * qu'aucune cellule « montant-like » de la zone de données n'a été oubliée.
 *
 * Filtre montant-like (sans config par feuille) : valeur ≥ 1 ET avec décimales —
 * exclut d'office les taux (0.65 < 1), les codes/tranches entiers, et tout ce qui
 * est au-dessus de `dataRowFrom` (multiplicateur, en-têtes, dates).
 *
 * Heuristique anti-faux-positif : une cellule non tracée dont la valeur existe déjà
 * dans une cellule TRACÉE de la même ligne est un doublon de cellule fusionnée
 * (ex: TW-CT colonnes C/M sans en-tête, copies de B/L), pas une perte.
 *
 * Limité aux feuilles denses ; les feuilles à structure irrégulière (tranches
 * salariales 2 échelles, W fan-out, activation formules, articles…) sont couvertes
 * par les contrats de compte + le round-trip + les ignoredRows des parsers.
 */
export interface CoverageSpec {
  sheetName: string
  /** Ligne 1-based où commence la zone de montants (exclut en-têtes/taux/multiplicateur). */
  dataRowFrom: number
  /** Valeurs numériques à ignorer même dans la zone (rare). */
  ignoreValues?: number[]
}

export const COVERAGE_SPECS: CoverageSpec[] = [
  { sheetName: 'A_N_B_vol_plein', dataRowFrom: 12 },
  { sheetName: 'A_N_B_half_demi', dataRowFrom: 12 },
  { sheetName: 'TW-CT_JS', dataRowFrom: 7 },
  { sheetName: 'SpecCat', dataRowFrom: 8 },
  { sheetName: 'Uurlonen_Salaires horaires', dataRowFrom: 8 },
]

export interface CoverageResult {
  sheet: string
  montantLike: number
  traced: number
  orphans: string[]
}

export function verifyCoverage(
  sheets: ParsedSheet[],
  amounts: BaremeAmountDraft[],
  ignoredRows: BaremeIgnoredRow[] = []
): { alerts: BaremeAlert[]; results: CoverageResult[] } {
  const alerts: BaremeAlert[] = []
  const results: CoverageResult[] = []
  const norm = (s: string) => s.trim()
  const sheetByName = new Map(sheets.map((s) => [norm(s.name), s]))

  // Cellules tracées (ref) + valeurs tracées par ligne, par feuille.
  const tracedRefs = new Map<string, Set<string>>()
  const tracedValuesByRow = new Map<string, Map<number, Set<number>>>()
  for (const a of amounts) {
    const cell = a.trace?.sourceCell
    if (!cell) continue
    const k = norm(a.sourceSheet)
    let refs = tracedRefs.get(k)
    if (!refs) { refs = new Set(); tracedRefs.set(k, refs) }
    refs.add(cell)
    const rc = parseRef(cell)
    const v = typeof a.trace?.normalizedValue === 'number' ? a.trace.normalizedValue : a.amount
    if (rc && typeof v === 'number') {
      let byRow = tracedValuesByRow.get(k)
      if (!byRow) { byRow = new Map(); tracedValuesByRow.set(k, byRow) }
      let set = byRow.get(rc.row)
      if (!set) { set = new Set(); byRow.set(rc.row, set) }
      set.add(round2(v))
    }
  }

  const ignoredBySheet = new Map<string, Set<number>>()
  for (const ir of ignoredRows) {
    const k = norm(ir.sheet)
    let set = ignoredBySheet.get(k)
    if (!set) { set = new Set(); ignoredBySheet.set(k, set) }
    set.add(ir.rowIndex)
  }

  for (const spec of COVERAGE_SPECS) {
    const k = norm(spec.sheetName)
    const sheet = sheetByName.get(k)
    if (!sheet) continue // l'absence est gérée par les contrats de structure
    const refs = tracedRefs.get(k) ?? new Set()
    const valuesByRow = tracedValuesByRow.get(k) ?? new Map()
    const ignoredRowSet = ignoredBySheet.get(k) ?? new Set()
    const ignore = new Set((spec.ignoreValues ?? []).map(round2))

    const orphans: string[] = []
    let montantLike = 0
    for (let r = 0; r < sheet.cellData.length; r++) {
      if (r + 1 < spec.dataRowFrom) continue
      if (ignoredRowSet.has(r + 1)) continue
      const row = sheet.cellData[r]
      for (let c = 0; c < row.length; c++) {
        const v = parseCellNumber(row[c])
        if (v === null || v < 1 || Number.isInteger(v) || ignore.has(round2(v))) continue
        montantLike++
        const ref = cellRef(r, c)
        if (refs.has(ref)) continue
        // doublon de cellule fusionnée : même valeur qu'une cellule tracée de la ligne
        if (valuesByRow.get(r)?.has(round2(v))) continue
        orphans.push(`${ref}=${v}`)
      }
    }

    results.push({ sheet: spec.sheetName, montantLike, traced: refs.size, orphans })

    if (orphans.length > 0) {
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'anomaly',
          title: 'Cellules montant non extraites (couverture inverse)',
          sheet: spec.sheetName,
          reason: `${orphans.length} cellule(s) de la zone de données de « ${spec.sheetName} » ressemblent à des montants mais n'ont été ni extraites ni ignorées : ${orphans.slice(0, 12).join(', ')}${orphans.length > 12 ? '…' : ''}. Montant oublié par le parser ?`,
          recommendation: 'Vérifier ces cellules dans la grille brute : si ce sont de vrais montants, adapter le parser ; sinon les déclarer (ignored).',
        })
      )
    }
  }

  return { alerts, results }
}

function parseRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase())
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: Number(m[2]) - 1, col: col - 1 }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
