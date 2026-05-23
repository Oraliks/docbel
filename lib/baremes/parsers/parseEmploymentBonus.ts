import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseEmploymentBonusOptions {
  validFrom: Date | null
}

/**
 * Parse Bonus (Werkbonus / Bonus à l'emploi).
 *
 * Structure : 2 catégories (employé privé, ouvrier privé). Pour chacune, 3 lignes
 * de tranches salariales (referent salary S) → bonus de base R :
 *  - "< X"          → bonus = montant (col G)
 *  - "> X en < Y"   → bonus dégressif (formule), montant de base en col G
 *  - "> Y"          → bonus = 0
 *
 * On extrait pour chaque catégorie : la borne basse du palier max et le bonus de base.
 * comparisonKey: "employment_bonus:CATEGORY:tier_NAME".
 */
export function parseEmploymentBonus(
  sheet: ParsedSheet,
  options: ParseEmploymentBonusOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  // Détecter les positions des 2 sections (Employé / Ouvrier)
  let employeeStart = -1
  let workerStart = -1
  for (let r = 0; r < sheet.cellData.length; r++) {
    const text = sheet.cellData[r].join(' ').toLowerCase()
    if (employeeStart === -1 && /employ.|bediende/.test(text)) employeeStart = r
    if (workerStart === -1 && /ouvrier|arbeider/.test(text)) workerStart = r
  }

  if (employeeStart >= 0) {
    extractTier(sheet, employeeStart, 'employee', options.validFrom, amounts)
  } else {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: 'Section "Employé / Bediende" non détectée',
    })
  }

  if (workerStart >= 0) {
    extractTier(sheet, workerStart, 'worker', options.validFrom, amounts)
  } else {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: 'Section "Ouvrier / Arbeider" non détectée',
    })
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucun bonus extrait',
    })
  }

  return { amounts, alerts }
}

function extractTier(
  sheet: ParsedSheet,
  startRow: number,
  category: 'employee' | 'worker',
  validFrom: Date | null,
  amounts: BaremeAmountDraft[]
) {
  // Chercher dans les ~10 lignes suivantes les tranches : opérateur en col B, seuil en C
  for (let r = startRow; r < Math.min(startRow + 15, sheet.cellData.length); r++) {
    const row = sheet.cellData[r]
    const op = (row[1] ?? '').trim() // col B : "<", ">", etc.
    const threshold = parseCellNumber(row[2]) // col C
    const bonus = parseCellNumber(row[6]) // col G

    if (!op || threshold === null) continue
    if (bonus === null) continue

    // Tier name : low / mid / zero — dérivé de l'opérateur
    let tier: string
    if (op === '<') {
      tier = `low_lt_${formatThreshold(threshold)}`
    } else if (op === '>') {
      const upperBound = parseCellNumber(row[4]) // col E (si plage)
      tier = upperBound !== null
        ? `mid_${formatThreshold(threshold)}_${formatThreshold(upperBound)}`
        : `high_gt_${formatThreshold(threshold)}`
    } else {
      continue
    }

    amounts.push({
      sourceSheet: sheet.name,
      category: 'employment_bonus',
      allocationCode: category,
      salaryCode: tier,
      amount: bonus,
      unit: 'monthly',
      minDailySalary: op === '>' ? threshold : null,
      maxDailySalary:
        op === '>' && parseCellNumber(row[4]) !== null
          ? parseCellNumber(row[4])
          : op === '<'
            ? threshold
            : null,
      validFrom,
      comparisonKey: `employment_bonus:${category}:${tier}`,
      rawData: {
        operator: op,
        threshold,
        upperBound: parseCellNumber(row[4]) ?? undefined,
        row: r + 1,
      },
    })
  }
}

function formatThreshold(n: number): string {
  return String(Math.round(n))
}
