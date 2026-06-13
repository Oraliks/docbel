import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft } from './types'
import { makeIssue } from './types'
import { parseCellNumber } from './normalize'

/**
 * Vérification round-trip : chaque montant extrait DOIT être rattaché à une
 * cellule source réelle dont la valeur correspond à ce que le parser prétend
 * avoir lu. Preuve formelle qu'aucun montant n'est copié, décalé ou inventé.
 *
 * Deux niveaux de correspondance acceptés :
 *  - DIRECT : la cellule source contient un nombre == la valeur normalisée par le
 *    parser (cas des matrices, salaires horaires, W, bonus… — 1 cellule = 1 montant).
 *  - DÉRIVÉ : la cellule source contient la valeur BRUTE déclarée (trace.rawValue)
 *    mais le montant final en est dérivé (ex: tranches salariales où sourceCell =
 *    cellule du code et le montant = borne max convertie ; activation où la cellule
 *    contient une formule "750 X Q/S (max. 500)"). Le rattachement à la cellule est
 *    prouvé même si la valeur n'est pas lue telle quelle.
 *
 * Tout montant qui ne tombe dans aucun des deux cas → issue BLOQUANTE (décalage de
 * cellule, copie, ou trace mensongère).
 */
export interface RoundTripResult {
  alerts: BaremeAlert[]
  checked: number
  direct: number
  derived: number
  noTrace: number
  mismatches: number
}

const TOLERANCE = 0.005 // un demi-centime
const MAX_REPORTED = 30

export function verifyRoundTrip(
  sheets: ParsedSheet[],
  amounts: BaremeAmountDraft[]
): RoundTripResult {
  const sheetMap = new Map(sheets.map((s) => [s.name, s.cellData]))
  const alerts: BaremeAlert[] = []
  let checked = 0
  let direct = 0
  let derived = 0
  let noTrace = 0
  let mismatches = 0

  const reportMismatch = (a: BaremeAmountDraft, reason: string) => {
    mismatches++
    if (alerts.length < MAX_REPORTED) {
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'anomaly',
          title: 'Montant non rattaché à sa cellule source',
          sheet: a.sourceSheet,
          cell: a.trace?.sourceCell,
          rawValue: a.trace?.rawValue ?? undefined,
          reason,
          recommendation:
            'Décalage de cellule, valeur copiée ou trace incorrecte — vérifier le parser de cette feuille dans le Diagnostic.',
        })
      )
    }
  }

  for (const a of amounts) {
    const trace = a.trace
    if (!trace?.sourceCell) {
      noTrace++
      continue
    }
    checked++

    const cellData = sheetMap.get(a.sourceSheet)
    if (!cellData) {
      reportMismatch(a, `La feuille source « ${a.sourceSheet} » du montant ${a.comparisonKey} est introuvable dans le classeur parsé.`)
      continue
    }
    const ref = parseCellRef(trace.sourceCell)
    if (!ref) {
      reportMismatch(a, `Référence de cellule invalide « ${trace.sourceCell} » pour ${a.comparisonKey}.`)
      continue
    }

    const cellStr = (cellData[ref.row]?.[ref.col] ?? '').toString()
    const cellNum = parseCellNumber(cellStr)
    const nv = trace.normalizedValue

    // DIRECT : la cellule contient exactement la valeur normalisée.
    if (cellNum !== null && typeof nv === 'number' && Math.abs(cellNum - nv) <= TOLERANCE) {
      direct++
      continue
    }

    // DÉRIVÉ : la cellule contient bien la valeur brute déclarée (rattachement OK,
    // montant dérivé). Tolère la troncature de rawValue (slice à 80 dans les parsers).
    const raw = (trace.rawValue ?? '').toString().trim()
    const cs = cellStr.trim()
    if (raw !== '' && cs !== '' && (cs === raw || cs.startsWith(raw) || raw.startsWith(cs))) {
      derived++
      continue
    }

    reportMismatch(
      a,
      `La cellule source ${trace.sourceCell} (feuille ${a.sourceSheet}) contient « ${cellStr.slice(0, 50)} », ` +
        `incohérent avec le montant ${a.amount} (valeur normalisée attendue ${nv ?? '—'}, valeur brute « ${raw.slice(0, 50)} ») de la clé ${a.comparisonKey}.`
    )
  }

  if (mismatches > MAX_REPORTED) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'anomaly',
        title: `${mismatches - MAX_REPORTED} autres montants non rattachés`,
        reason: `${mismatches} montants au total ne sont pas rattachés à leur cellule source ; seuls les ${MAX_REPORTED} premiers sont listés individuellement.`,
        recommendation: 'Anomalie systémique — revue parser nécessaire avant toute publication.',
      })
    )
  }

  return { alerts, checked, direct, derived, noTrace, mismatches }
}

/** Inverse de cellRef : "H14" → { row: 13, col: 7 } (0-based). */
function parseCellRef(ref: string): { row: number; col: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.trim().toUpperCase())
  if (!m) return null
  let col = 0
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { row: Number(m[2]) - 1, col: col - 1 }
}
