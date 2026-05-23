import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseAllocationWOptions {
  validFrom: Date | null
}

/**
 * Parse l'onglet "W " — Allocations W (insertion / sauvegarde).
 *
 * Structure libre par lignes :
 *   - col F : libellé bilingue (FR/NL) de la situation
 *   - col M : codes ONEM espacés (ex: "WA2V WA7V", "WA2 WA72 DA1 DA2")
 *   - col N : condition d'âge (ex: "> 21", "< 18", "//")
 *   - col P : montant pleine allocation (quotidien)
 *   - col R : montant demi allocation (quotidien)
 *
 * Pour chaque code listé en col M, on émet 1 entrée "plein" + 1 "demi" si présents.
 * comparisonKey: "allocation_w:CODE[:age_condition]" pour stabilité du diff.
 */
export function parseAllocationW(
  sheet: ParsedSheet,
  options: ParseAllocationWOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []
  const seenKeys = new Set<string>()

  for (let r = 0; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const codesCell = (row[12] ?? '').trim() // col M
    if (!codesCell) continue

    // Extraire chaque code séparé par espaces
    const codes = codesCell
      .split(/\s+/)
      .map((c) => c.trim())
      .filter((c) => c && /^[A-Z]{2,4}\d*[A-Z]?$/i.test(c))

    if (codes.length === 0) continue

    const ageCondition = (row[13] ?? '').trim() // col N
    const fullAmount = parseCellNumber(row[15]) // col P
    const halfAmount = parseCellNumber(row[17]) // col R
    const labelCell = (row[5] ?? '').trim() // col F

    // Label : tente de séparer NL / FR (parfois mêlés par retour à la ligne)
    const labelParts = labelCell.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean)
    const labelNl = labelParts[0] ?? null
    const labelFr = labelParts[1] ?? null

    const condTag = !ageCondition || ageCondition === '//' ? '' : `:${normalizeCondition(ageCondition)}`

    for (const code of codes) {
      if (fullAmount !== null) {
        const key = `allocation_w:${code}:full${condTag}`
        if (!seenKeys.has(key)) {
          amounts.push({
            sourceSheet: sheet.name,
            category: 'allocation_w',
            allocationCode: code,
            salaryCode: 'full',
            labelNl,
            labelFr,
            amount: fullAmount,
            unit: 'daily',
            validFrom: options.validFrom,
            comparisonKey: key,
            rawData: { ageCondition: ageCondition || undefined, row: r + 1 },
          })
          seenKeys.add(key)
        }
      }
      if (halfAmount !== null) {
        const key = `allocation_w:${code}:half${condTag}`
        if (!seenKeys.has(key)) {
          amounts.push({
            sourceSheet: sheet.name,
            category: 'allocation_w',
            allocationCode: code,
            salaryCode: 'half',
            labelNl,
            labelFr,
            amount: halfAmount,
            unit: 'daily',
            validFrom: options.validFrom,
            comparisonKey: key,
            rawData: { ageCondition: ageCondition || undefined, row: r + 1 },
          })
          seenKeys.add(key)
        }
      }
    }
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucune allocation W extraite (vérifier les colonnes M/P/R)',
    })
  }

  return { amounts, alerts }
}

function normalizeCondition(c: string): string {
  // Transforme "> 21" → "gt21", "< 18" → "lt18", "> 18 en < 21" → "gt18_lt21"
  return c
    .replace(/\s+/g, '')
    .replace(/>=/g, 'gte')
    .replace(/<=/g, 'lte')
    .replace(/>/g, 'gt')
    .replace(/</g, 'lt')
    .replace(/en/gi, '_')
    .replace(/[^a-z0-9_]/gi, '')
    .toLowerCase()
}
