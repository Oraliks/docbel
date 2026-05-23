import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { parseCellInteger, parseCellNumber } from '../normalize'

interface ParseSalaryBracketsOptions {
  validFrom: Date | null
}

const MIN_CODE = 1
const MAX_CODE = 200 // garde-fou: codes de tranches ONEM montent jusqu'à ~150

/**
 * Parse l'onglet Loonschijven_Tranches salariale.
 *
 * Structure: 2 tables en parallèle dans la feuille.
 *  - Table gauche  : colonnes (min, max, _, code)
 *      ex: B=62.0788, C=63.6114, E=29
 *  - Table droite  : colonnes (code, min, max, _)
 *      ex: M=1, N=10.7914, O=11.6544
 *
 * Stratégie : on scanne toutes les lignes/colonnes à la recherche d'un
 * entier de code valide (1..200) accompagné d'au moins 2 nombres dans
 * les cellules voisines suivant l'un des 2 layouts. On déduplique par code.
 *
 * Cette approche tolère les variations de mise en page (ajout/suppression
 * d'une colonne vide) tant que la séquence min/max/code reste contiguë.
 */
export function parseSalaryBrackets(
  sheet: ParsedSheet,
  options: ParseSalaryBracketsOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const found = new Map<number, BaremeAmountDraft>()

  for (let r = 0; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    for (let c = 0; c < row.length; c++) {
      const code = parseCellInteger(row[c])
      if (code === null) continue
      if (code < MIN_CODE || code > MAX_CODE) continue
      if (found.has(code)) continue

      // Layout "table gauche" : min en c-3, max en c-2
      if (c >= 3) {
        const min = parseCellNumber(row[c - 3])
        const max = parseCellNumber(row[c - 2])
        if (min !== null && max !== null && max >= min) {
          found.set(code, makeAmount(sheet.name, code, min, max, options.validFrom, r, c))
          continue
        }
      }

      // Layout "table droite" : min en c+1, max en c+2
      if (c + 2 < row.length) {
        const min = parseCellNumber(row[c + 1])
        const max = parseCellNumber(row[c + 2])
        if (min !== null && max !== null && max >= min) {
          // Optionnel : 3ème valeur en c+3 (médiane ?) stockée dans rawData
          const third = c + 3 < row.length ? parseCellNumber(row[c + 3]) : null
          const draft = makeAmount(sheet.name, code, min, max, options.validFrom, r, c)
          if (third !== null) {
            draft.rawData = { ...draft.rawData, midDailySalary: third }
          }
          found.set(code, draft)
          continue
        }
      }
    }
  }

  if (found.size === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucune tranche salariale détectée (structure inattendue)',
    })
  } else {
    // Vérifier la continuité: si codes 1..N attendus mais des trous, signaler
    const codes = [...found.keys()].sort((a, b) => a - b)
    const maxFound = codes[codes.length - 1]
    const expected = maxFound // attendu = continu de 1 à maxFound
    const missing: number[] = []
    for (let i = 1; i <= expected; i++) {
      if (!found.has(i)) missing.push(i)
    }
    if (missing.length > 0 && missing.length < 10) {
      alerts.push({
        level: 'warn',
        sheet: sheet.name,
        message: `Tranches manquantes dans la séquence: ${missing.join(', ')}`,
      })
    } else if (missing.length >= 10) {
      alerts.push({
        level: 'info',
        sheet: sheet.name,
        message: `${missing.length} tranches non détectées dans la séquence 1..${expected}`,
      })
    }
  }

  return { amounts: [...found.values()], alerts }
}

function makeAmount(
  sheetName: string,
  code: number,
  min: number,
  max: number,
  validFrom: Date | null,
  row: number,
  col: number
): BaremeAmountDraft {
  return {
    sourceSheet: sheetName,
    category: 'salary_bracket',
    salaryCode: String(code),
    amount: max, // amount = borne supérieure (compatibilité champ obligatoire)
    minDailySalary: min,
    maxDailySalary: max,
    unit: 'daily',
    validFrom,
    comparisonKey: `salary_bracket:${code}`,
    rawData: { row: row + 1, col: col + 1 },
  }
}
