import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeCategory,
  ParserResult,
} from '../types'
import { parseCellNumber, parseCodeCell } from '../normalize'

interface ParseAllocationMatrixOptions {
  /** Catégorie à attribuer aux montants extraits (varie selon la feuille). */
  category: BaremeCategory
  /** Date de validité héritée du fichier. */
  validFrom: Date | null
}

const HEADER_KEYWORD = 'code'
// Tranches salariales légitimes: "MIN", "MAX", ou entier 1..99
const TRANCHE_REGEX = /^(MIN|MAX|\d{1,3})$/i

/**
 * Parse un onglet de type matrice "code allocation × tranche salariale" → montant.
 *
 * Structure attendue (cf. A_N_B_vol_plein, A_N_B_half_demi) :
 *  - Une ligne d'en-tête où la colonne A vaut "Code", et les colonnes
 *    suivantes contiennent les codes d'allocation (AA1, AA2, NB/NX, …).
 *  - En dessous, des lignes dont la colonne A vaut "MIN" ou un entier
 *    (la tranche salariale). À l'intersection ligne × colonne se trouve
 *    le montant d'allocation.
 *  - Les codes peuvent être empilés sur plusieurs lignes dans une seule
 *    cellule (ex: "AB\nAX") — on émet alors un montant par code.
 *  - Les cellules commençant par "#" sont des erreurs de formule et sont ignorées.
 */
export function parseAllocationMatrix(
  sheet: ParsedSheet,
  options: ParseAllocationMatrixOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  const headerRowIndex = findHeaderRow(sheet)
  if (headerRowIndex === -1) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: `Ligne d'en-tête introuvable (cellule "Code" attendue en colonne A)`,
    })
    return { amounts, alerts }
  }

  // Extraire (colIndex, code) à partir de la ligne d'en-tête
  const headerRow = sheet.cellData[headerRowIndex]
  const codeColumns: { colIndex: number; code: string }[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const codes = parseCodeCell(headerRow[c])
    for (const code of codes) {
      codeColumns.push({ colIndex: c, code })
    }
  }

  if (codeColumns.length === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: `Aucun code d'allocation détecté dans la ligne d'en-tête (ligne ${headerRowIndex + 1})`,
    })
    return { amounts, alerts }
  }

  // Parcourir les lignes de données (après l'en-tête)
  let extracted = 0
  let skippedErrorCells = 0
  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const tranche = (row[0] ?? '').trim()
    if (!tranche) continue
    if (!TRANCHE_REGEX.test(tranche)) {
      // Pas une ligne de tranche → on s'arrête (le bas de feuille peut contenir des notes)
      // Sauf si c'est une ligne complètement vide entre deux blocs : on continue silencieusement
      const isEmptyRow = row.every((c) => !c || !c.trim())
      if (isEmptyRow) continue
      break
    }

    const salaryCode = tranche.toUpperCase()

    for (const { colIndex, code } of codeColumns) {
      const cellValue = row[colIndex]
      if (cellValue && cellValue.startsWith('#')) {
        skippedErrorCells++
        continue
      }
      const amount = parseCellNumber(cellValue)
      if (amount === null) continue

      const comparisonKey = `${options.category}:${code}:${salaryCode}`
      amounts.push({
        sourceSheet: sheet.name,
        category: options.category,
        allocationCode: code,
        salaryCode,
        amount,
        validFrom: options.validFrom,
        unit: 'daily', // les allocations chômage sont quotidiennes
        comparisonKey,
        rawData: { cell: cellRef(r, colIndex) },
      })
      extracted++
    }
  }

  if (extracted === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: `Aucun montant extrait (${codeColumns.length} codes détectés, aucune ligne de tranche valide)`,
    })
  }

  if (skippedErrorCells > 0) {
    alerts.push({
      level: 'info',
      sheet: sheet.name,
      message: `${skippedErrorCells} cellules d'erreur Excel (#REF!, #N/A, …) ignorées`,
    })
  }

  return { amounts, alerts }
}

function findHeaderRow(sheet: ParsedSheet): number {
  for (let r = 0; r < sheet.cellData.length; r++) {
    const cellA = (sheet.cellData[r][0] ?? '').trim().toLowerCase()
    if (cellA === HEADER_KEYWORD) return r
  }
  return -1
}

function cellRef(r: number, c: number): string {
  // Conversion index colonne → lettres Excel (0→A, 25→Z, 26→AA, …)
  let n = c
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${letters}${r + 1}`
}
