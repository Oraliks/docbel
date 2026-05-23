import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseActivationOptions {
  validFrom: Date | null
}

/**
 * Parse Activering_Activation (allocations d'activation).
 *
 * Structure : plusieurs sous-sections (SINE oude/nieuwe regeling, ACTIVA-WALLONIE,
 * ACTIVA-BRUSSEL), chacune avec un mini-tableau code → montant max mensuel.
 *
 * On scanne la feuille à la recherche de paires (code, montant) :
 *  - dans le bloc gauche (col A = code, col B = montant)
 *  - dans le bloc droit (col I = code, col J = montant)
 *
 * Les valeurs qui contiennent des formules (ex: "500,00 X U/[Sx4]") sont stockées
 * dans rawData mais l'`amount` n'est rempli que si la cellule contient un nombre
 * pur. Pour les formules avec un montant numérique en préfixe, on capte ce préfixe.
 */
export function parseActivation(
  sheet: ParsedSheet,
  options: ParseActivationOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []
  const seenKeys = new Set<string>()

  let currentSubcategory: string | null = null

  for (let r = 0; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]

    // Tentative de détecter le nom de la sous-section (texte large en A ou I)
    const cellA = (row[0] ?? '').trim()
    const cellI = (row[8] ?? '').trim()
    const subcatCandidate = detectSubcategory(cellA) ?? detectSubcategory(cellI)
    if (subcatCandidate) {
      currentSubcategory = subcatCandidate
      continue
    }

    // Couple gauche : code en A, montant en B
    addAmountIfValid({
      code: cellA,
      amountCell: row[1] ?? '',
      subcategory: currentSubcategory,
      sheet,
      validFrom: options.validFrom,
      row: r,
      amounts,
      seenKeys,
    })

    // Couple droit : code en I, montant en J
    addAmountIfValid({
      code: cellI,
      amountCell: row[9] ?? '',
      subcategory: currentSubcategory,
      sheet,
      validFrom: options.validFrom,
      row: r,
      amounts,
      seenKeys,
    })
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: 'Aucun montant d\'activation extrait (beaucoup de formules complexes)',
    })
  }

  return { amounts, alerts }
}

interface AddAmountInput {
  code: string
  amountCell: string
  subcategory: string | null
  sheet: ParsedSheet
  validFrom: Date | null
  row: number
  amounts: BaremeAmountDraft[]
  seenKeys: Set<string>
}

function addAmountIfValid(input: AddAmountInput) {
  const codeRaw = input.code.trim()
  // Garder uniquement les codes qui ressemblent à des codes ONEM (lettres/chiffres/slash/points)
  if (!codeRaw || codeRaw.length < 2 || codeRaw.length > 30) return
  if (!/^[A-Z]/i.test(codeRaw)) return // doit commencer par une lettre
  if (/[éèàùôîç]/i.test(codeRaw)) return // exclu si caractère accentué (probablement texte)
  if (codeRaw.split(' ').length > 4) return // trop long, c'est probablement une phrase

  const amountCell = input.amountCell.trim()
  if (!amountCell) return

  // Soit nombre pur, soit formule commençant par un nombre (ex: "500,00 X U/[Sx4]")
  let amount: number | null = parseCellNumber(amountCell)
  let isFormula = false

  if (amount === null) {
    const match = amountCell.match(/^(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?)/)
    if (match) {
      amount = parseCellNumber(match[1])
      isFormula = amount !== null
    }
  }

  if (amount === null) return

  const subcat = input.subcategory ? normalizeKey(input.subcategory) : 'unknown'
  const codeKey = normalizeKey(codeRaw)
  const key = `activation:${subcat}:${codeKey}`
  if (input.seenKeys.has(key)) return

  input.amounts.push({
    sourceSheet: input.sheet.name,
    category: 'activation',
    allocationCode: codeRaw,
    amount,
    unit: 'monthly',
    validFrom: input.validFrom,
    comparisonKey: key,
    rawData: {
      subcategory: input.subcategory ?? undefined,
      isFormula,
      originalCell: amountCell,
      row: input.row + 1,
    },
  })
  input.seenKeys.add(key)
}

function detectSubcategory(cell: string): string | null {
  const lower = cell.toLowerCase()
  if (/sine/.test(lower) && /oude|nieuwe|nouveau|ancien/.test(lower)) {
    return cell
  }
  if (/^sine$/i.test(cell)) return 'SINE'
  if (/activa.*wallonie|activa.*wallon/i.test(cell)) return 'ACTIVA-WALLONIE'
  if (/activa.*brussel|activa.*bruxelles/i.test(cell)) return 'ACTIVA-BRUSSEL'
  return null
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}
