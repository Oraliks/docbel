import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellInteger, parseCellNumber } from '../normalize'

interface ParseHourlyWagesOptions {
  validFrom: Date | null
}

/**
 * Parse Uurlonen_Salaires horaires.
 *
 * Structure (matrice 2D code × heures/semaine) :
 *   - Ligne d'en-tête repérée par "Code" en colonne C (et "Q" en colonne A)
 *   - À partir de la colonne D : valeurs d'heures/semaine (40, 39.5, 39, …)
 *   - Sous l'en-tête : col C = code de tranche salariale (29, 30, …), cols D+ = salaire horaire
 *
 * Emet un BaremeAmount par (code, hours) avec comparisonKey "hourly_wage:CODE:HOURS".
 */
export function parseHourlyWages(
  sheet: ParsedSheet,
  options: ParseHourlyWagesOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  // Localiser la ligne d'en-tête : on cherche "Code" en col C
  let headerRowIndex = -1
  for (let r = 0; r < Math.min(sheet.cellData.length, 20); r++) {
    const row = sheet.cellData[r]
    if ((row[2] ?? '').trim().toLowerCase() === 'code') {
      headerRowIndex = r
      break
    }
  }

  if (headerRowIndex === -1) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Ligne d'en-tête introuvable",
        sheet: sheet.name,
        reason: 'Aucune cellule "Code" trouvée en colonne C — le template hourly_wages ne reconnaît pas cette feuille.',
        recommendation: 'Vérifier la grille brute ; adapter le parser hourly_wages si la structure a changé.',
      })
    )
    return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
  }

  const headerRow = sheet.cellData[headerRowIndex]

  // Récupérer les heures/semaine à partir de la colonne D
  const hoursCols: { colIndex: number; hours: number }[] = []
  for (let c = 3; c < headerRow.length; c++) {
    const hours = parseCellNumber(headerRow[c])
    if (hours !== null && hours > 0 && hours <= 50) {
      hoursCols.push({ colIndex: c, hours })
    }
  }

  if (hoursCols.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Aucune colonne d'heures détectée",
        sheet: sheet.name,
        row: headerRowIndex + 1,
        reason: "La ligne d'en-tête ne contient aucune valeur d'heures/semaine exploitable (attendu : 40, 39.5, 38, …).",
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
    return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
  }

  let extracted = 0
  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const code = parseCellInteger(row[2])
    if (code === null) continue
    if (code < 1 || code > 200) continue

    for (const { colIndex, hours } of hoursCols) {
      const rawValue = row[colIndex] ?? ''
      const amount = parseCellNumber(rawValue)
      if (amount === null) continue

      const hoursStr = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
      const amountCell = cellRef(r, colIndex)
      amounts.push({
        sourceSheet: sheet.name,
        category: 'hourly_wage',
        salaryCode: String(code),
        amount,
        unit: 'hourly',
        validFrom: options.validFrom,
        comparisonKey: `hourly_wage:${code}:${hoursStr}`,
        rawData: { hoursPerWeek: hours, row: r + 1, col: colIndex + 1 },
        status: 'valid',
        warnings: [],
        trace: {
          sourceCell: amountCell,
          sourceRowIndex: r + 1,
          sourceColumnIndex: colIndex + 1,
          rawValue: rawValue.trim(),
          normalizedValue: amount,
          mappingKey: `tranche ${code} × ${hoursStr}h`,
          mappingFile: null,
          transformTemplate: 'hourly_wages',
          transformReason:
            `Ce salaire horaire provient de la feuille ${sheet.name}, cellule ${amountCell}. ` +
            `Il correspond au code de tranche ${code} (colonne C, ligne ${r + 1}) pour un régime de ${hoursStr} heures/semaine ` +
            `(en-tête de colonne, ligne ${headerRowIndex + 1}). ` +
            `Le montant ${amount} a été normalisé depuis la valeur brute « ${rawValue.trim()} ».`,
        },
      })
      extracted++
    }
  }

  if (extracted === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucun salaire horaire extrait',
        sheet: sheet.name,
        reason: "L'en-tête a été reconnu mais aucune ligne code × heures n'a produit de montant.",
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
  }

  return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
}
