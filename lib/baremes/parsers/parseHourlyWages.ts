import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
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
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Ligne d\'en-tête introuvable (cellule "Code" attendue en colonne C)',
    })
    return { amounts, alerts }
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
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucune colonne d\'heures/semaine détectée dans la ligne d\'en-tête',
    })
    return { amounts, alerts }
  }

  let extracted = 0
  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const code = parseCellInteger(row[2])
    if (code === null) continue
    if (code < 1 || code > 200) continue

    for (const { colIndex, hours } of hoursCols) {
      const amount = parseCellNumber(row[colIndex])
      if (amount === null) continue

      const hoursStr = Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
      amounts.push({
        sourceSheet: sheet.name,
        category: 'hourly_wage',
        salaryCode: String(code),
        amount,
        unit: 'hourly',
        validFrom: options.validFrom,
        comparisonKey: `hourly_wage:${code}:${hoursStr}`,
        rawData: { hoursPerWeek: hours, row: r + 1, col: colIndex + 1 },
      })
      extracted++
    }
  }

  if (extracted === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucun salaire horaire extrait',
    })
  }

  return { amounts, alerts }
}
