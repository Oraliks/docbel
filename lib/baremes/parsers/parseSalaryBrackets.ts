import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  ParserResult,
} from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellInteger, parseCellNumber } from '../normalize'

interface ParseSalaryBracketsOptions {
  validFrom: Date | null
}

const MIN_CODE = 1
const MAX_CODE = 200 // garde-fou: codes de tranches ONEM montent jusqu'à ~150

interface RawEntry {
  min: number
  /** null = tranche ouverte (pas de borne supérieure) — le code le plus haut. */
  max: number | null
  median?: number | null
  minCell: string
  maxCell: string
  rawMin: string
  rawMax: string
  row: number
  col: number
}

/**
 * Parse l'onglet Loonschijven_Tranches salariale.
 *
 * Structure : DEUX tables en parallèle dans la feuille.
 *  - Table GAUCHE (layout min, max, _, code) : salaires journaliers INDEXÉS
 *    (échelle courante), codes ~29..99. Ex: B=62.0788, C=63.6114, E=29.
 *  - Table DROITE (layout code, min, max, médiane) : salaires de BASE NON indexés,
 *    codes 1..99. Ex: N=29, O=34.9582, P=35.8212, Q=35.3898.
 *    base × multiplicateur d'indexation = valeur indexée (vérifié : 34.9582×1.7758 ≈ 62.0788).
 *
 * ⚠️ Bug historique : la déduplication « premier trouvé gagne » mélangeait les
 * échelles — les codes 1..28 (présents uniquement à droite) sortaient à l'échelle
 * de BASE tandis que 29..98 sortaient indexés → série discontinue, lookup faux sous
 * ~62 €/j. Et le code 99 (tranche ouverte, sans borne max) était totalement perdu.
 *
 * Corrigé : on collecte SÉPARÉMENT les deux échelles par code, on dérive le ratio
 * d'indexation depuis les codes présents aux deux échelles (auto-validant), on
 * privilégie l'échelle indexée, et on convertit les codes base-only à l'échelle
 * indexée (×ratio). La tranche ouverte (max absent) est conservée (maxDailySalary
 * = null). Décision de domaine à valider par l'admin : convertir vs exclure les
 * basses tranches — ici on CONVERTIT pour préserver la continuité du lookup.
 */
export function parseSalaryBrackets(
  sheet: ParsedSheet,
  options: ParseSalaryBracketsOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const leftByCode = new Map<number, RawEntry>() // échelle indexée, borne max
  const rightByCode = new Map<number, RawEntry>() // échelle de base, borne max
  // Candidates "tranche ouverte" (min présent, max absent) — NE sont promues
  // qu'en post-scan, uniquement pour le code = (plus haut code borné) + 1, afin
  // d'éviter qu'un nombre isolé (ex: une valeur min) soit pris pour un code ouvert.
  const leftOpen = new Map<number, RawEntry>()
  const rightOpen = new Map<number, RawEntry>()

  for (let r = 0; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    for (let c = 0; c < row.length; c++) {
      const code = parseCellInteger(row[c])
      if (code === null || code < MIN_CODE || code > MAX_CODE) continue

      // Layout "table gauche" (indexée) : min en c-3, max en c-2.
      if (c >= 3 && !leftByCode.has(code) && !leftOpen.has(code)) {
        const min = parseCellNumber(row[c - 3])
        const max = parseCellNumber(row[c - 2])
        if (min !== null) {
          const entry: RawEntry = {
            min,
            max,
            minCell: cellRef(r, c - 3),
            maxCell: cellRef(r, c - 2),
            rawMin: row[c - 3] ?? '',
            rawMax: row[c - 2] ?? '',
            row: r,
            col: c,
          }
          if (max !== null && max >= min) {
            leftByCode.set(code, entry)
            continue
          }
          if (max === null) {
            leftOpen.set(code, entry)
            continue
          }
        }
      }

      // Layout "table droite" (base) : min en c+1, max en c+2, médiane en c+3.
      if (c + 1 < row.length && !rightByCode.has(code) && !rightOpen.has(code)) {
        const min = parseCellNumber(row[c + 1])
        const max = c + 2 < row.length ? parseCellNumber(row[c + 2]) : null
        if (min !== null) {
          const entry: RawEntry = {
            min,
            max,
            median: c + 3 < row.length ? parseCellNumber(row[c + 3]) : null,
            minCell: cellRef(r, c + 1),
            maxCell: cellRef(r, c + 2),
            rawMin: row[c + 1] ?? '',
            rawMax: row[c + 2] ?? '',
            row: r,
            col: c,
          }
          if (max !== null && max >= min) rightByCode.set(code, entry)
          else if (max === null) rightOpen.set(code, entry)
        }
      }
    }
  }

  // Tranche OUVERTE : on ne promeut que le code (plus haut code borné + 1).
  const boundedCodes = [...new Set([...leftByCode.keys(), ...rightByCode.keys()])]
  if (boundedCodes.length) {
    const openCode = Math.max(...boundedCodes) + 1
    if (leftOpen.has(openCode)) leftByCode.set(openCode, leftOpen.get(openCode)!)
    else if (rightOpen.has(openCode)) rightByCode.set(openCode, rightOpen.get(openCode)!)
  }

  // Ratio d'indexation dérivé des codes présents aux DEUX échelles (auto-validant).
  const ratios: number[] = []
  for (const [code, left] of leftByCode) {
    const right = rightByCode.get(code)
    if (right && right.min > 0) ratios.push(left.min / right.min)
  }
  const ratio = ratios.length ? round4(median(ratios)) : null
  const ratioSpread =
    ratios.length > 1 ? (Math.max(...ratios) - Math.min(...ratios)) / median(ratios) : 0

  const allCodes = [...new Set([...leftByCode.keys(), ...rightByCode.keys()])].sort(
    (a, b) => a - b
  )
  const topCode = allCodes[allCodes.length - 1]

  const amounts: BaremeAmountDraft[] = []
  let convertedCount = 0
  let baseUnconvertedCount = 0
  for (const code of allCodes) {
    const left = leftByCode.get(code)
    if (left) {
      // Échelle indexée disponible : on l'utilise telle quelle.
      amounts.push(
        makeAmount(sheet.name, code, left, options.validFrom, {
          scale: 'indexée',
          isOpen: left.max === null,
          isTop: code === topCode,
        })
      )
      continue
    }
    const right = rightByCode.get(code)
    if (!right) continue

    if (ratio !== null) {
      // Échelle de base uniquement → conversion vers l'échelle indexée (×ratio).
      convertedCount++
      const converted: RawEntry = {
        ...right,
        min: round4(right.min * ratio),
        max: right.max === null ? null : round4(right.max * ratio),
      }
      amounts.push(
        makeAmount(sheet.name, code, converted, options.validFrom, {
          scale: 'convertie',
          ratio,
          baseMin: right.min,
          baseMax: right.max,
          isOpen: right.max === null,
          isTop: code === topCode,
        })
      )
    } else {
      // Aucun code chevauchant les deux échelles → ratio indéterminé : on émet la
      // valeur de base telle quelle (jamais de perte silencieuse) avec un signalement.
      baseUnconvertedCount++
      amounts.push(
        makeAmount(sheet.name, code, right, options.validFrom, {
          scale: 'base',
          isOpen: right.max === null,
          isTop: code === topCode,
        })
      )
    }
  }

  // Diagnostics
  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucune tranche salariale détectée',
        sheet: sheet.name,
        reason:
          "Le scan des deux tables (gauche min/max/code indexée, droite code/min/max base) n'a trouvé aucune tranche — structure inattendue.",
        recommendation:
          'Vérifier la grille brute dans le Diagnostic ; adapter le parser salary_brackets si la mise en page ONEM a changé.',
      })
    )
  } else {
    if (convertedCount > 0 && ratio !== null) {
      alerts.push(
        makeIssue({
          severity: 'info',
          kind: 'anomaly',
          title: 'Tranches converties à l\'échelle indexée',
          sheet: sheet.name,
          reason: `Cette feuille contient deux échelles : table gauche INDEXÉE (codes présents) et table droite de BASE (non indexée). ${convertedCount} tranche(s) présente(s) uniquement à l'échelle de base ont été converties à l'échelle indexée en multipliant par le ratio ${ratio} (dérivé des codes présents aux deux échelles). Décision admin : convertir (choix actuel, série continue) ou exclure ces basses tranches du barème applicable.`,
          recommendation:
            'Vérifier que le ratio correspond bien au multiplicateur d\'indexation ONEM (cellule K1). Si les basses tranches ne doivent pas figurer au barème courant, le signaler pour les exclure.',
        })
      )
    }
    if (baseUnconvertedCount > 0) {
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'anomaly',
          title: "Tranches à l'échelle de base non converties",
          sheet: sheet.name,
          reason: `${baseUnconvertedCount} tranche(s) ne figurent qu'à l'échelle de base et aucun code commun aux deux échelles n'a permis de dériver le ratio d'indexation — elles sont émises telles quelles (échelle de base).`,
          recommendation: 'Vérifier la structure des deux tables dans la grille brute.',
        })
      )
    }
    if (ratioSpread > 0.005) {
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'anomaly',
          title: "Ratio d'indexation incohérent entre tranches",
          sheet: sheet.name,
          reason: `Le ratio indexé/base varie de ${(ratioSpread * 100).toFixed(2)} % entre les tranches (attendu : quasi constant). La structure à deux échelles est peut-être différente de l'hypothèse.`,
          recommendation: 'Vérifier manuellement les deux tables dans la grille brute.',
        })
      )
    }
    // Continuité de la séquence de codes
    const missing: number[] = []
    for (let i = 1; i <= topCode; i++) {
      if (!leftByCode.has(i) && !rightByCode.has(i)) missing.push(i)
    }
    if (missing.length > 0) {
      alerts.push(
        makeIssue({
          severity: missing.length < 10 ? 'warning' : 'info',
          kind: 'partial_sheet',
          title: 'Tranches manquantes',
          sheet: sheet.name,
          reason: `Les codes de tranche ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''} sont absents de la séquence 1..${topCode}.`,
          recommendation:
            "Vérifier dans la grille brute si ces codes existent ; le cas échéant adapter le parser salary_brackets.",
        })
      )
    }
  }

  return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
}

interface MakeAmountMeta {
  scale: 'indexée' | 'convertie' | 'base'
  ratio?: number
  baseMin?: number
  baseMax?: number | null
  isOpen: boolean
  isTop: boolean
}

function makeAmount(
  sheetName: string,
  code: number,
  entry: RawEntry,
  validFrom: Date | null,
  meta: MakeAmountMeta
): BaremeAmountDraft {
  const codeCell = cellRef(entry.row, entry.col)
  const amount = entry.max ?? entry.min // borne sup, ou borne inf si tranche ouverte
  const openNote = meta.isOpen ? ' Tranche OUVERTE : pas de borne supérieure (salaires au-dessus du minimum).' : ''
  const scaleNote =
    meta.scale === 'convertie'
      ? ` Cette tranche n'existait qu'à l'échelle de BASE (min ${meta.baseMin}${meta.baseMax != null ? `, max ${meta.baseMax}` : ''}) ; elle a été convertie à l'échelle indexée en multipliant par ${meta.ratio}.`
      : ''
  return {
    sourceSheet: sheetName,
    category: 'salary_bracket',
    salaryCode: String(code),
    amount,
    minDailySalary: entry.min,
    maxDailySalary: entry.max,
    unit: 'daily',
    validFrom,
    comparisonKey: `salary_bracket:${code}`,
    rawData: {
      row: entry.row + 1,
      col: entry.col + 1,
      scale: meta.scale,
      ...(meta.scale === 'convertie' ? { indexRatio: meta.ratio, baseMin: meta.baseMin, baseMax: meta.baseMax } : {}),
      ...(entry.median != null ? { midDailySalary: entry.median } : {}),
      ...(meta.isOpen ? { openBracket: true } : {}),
    },
    status: 'valid',
    warnings: meta.isOpen ? ['Tranche ouverte (pas de plafond supérieur)'] : [],
    trace: {
      sourceCell: codeCell,
      sourceRowIndex: entry.row + 1,
      sourceColumnIndex: entry.col + 1,
      rawValue: String(code),
      normalizedValue: amount,
      mappingKey: `tranche ${code}`,
      mappingFile: null,
      transformTemplate: 'salary_brackets',
      transformReason:
        `Cette tranche provient de la feuille ${sheetName} : le code ${code} a été détecté en ${codeCell} (échelle ${meta.scale}). ` +
        `Le salaire journalier minimum ${entry.min} vient de ${entry.minCell}` +
        (entry.max !== null
          ? ` et le maximum ${entry.max} de ${entry.maxCell}.`
          : `.`) +
        scaleNote +
        openNote,
    },
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
