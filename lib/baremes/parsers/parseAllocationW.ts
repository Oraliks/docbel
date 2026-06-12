import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeUnknownCode,
  ParserResult,
} from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellNumber } from '../normalize'
import { CODE_MAPPING_FILE, resolveCodeInfo } from '../code-mapping'
import { IGNORED_CODES_FILE, isIgnoredCode } from '../ignored-codes'

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
  const unknownCodes: BaremeUnknownCode[] = []
  const seenKeys = new Set<string>()
  const seenUnknown = new Set<string>()

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
    const codesCellRef = cellRef(r, 12)

    for (const code of codes) {
      if (isIgnoredCode(code, 'allocation_w')) continue
      const info = resolveCodeInfo(code, 'allocation_w')
      if (!info && !seenUnknown.has(code)) {
        seenUnknown.add(code)
        unknownCodes.push({
          sheet: sheet.name,
          cell: codesCellRef,
          code,
          category: 'allocation_w',
          recommendation: `Ajouter "${code}" dans ${CODE_MAPPING_FILE} (section allocationWCodes) ou le déclarer dans ${IGNORED_CODES_FILE}.`,
        })
        alerts.push(
          makeIssue({
            severity: 'warning',
            kind: 'unknown_code',
            title: 'Code ONEM non mappé',
            sheet: sheet.name,
            cell: codesCellRef,
            row: r + 1,
            rawValue: codesCell.slice(0, 80),
            reason: `Le code "${code}" (allocations W) n'est ni mappé ni déclaré comme ignoré. Les montants sont extraits mais marqués "à vérifier".`,
            recommendation: `Ajouter "${code}" dans ${CODE_MAPPING_FILE} ou dans ${IGNORED_CODES_FILE} avec une raison explicite.`,
          })
        )
      }
      const isKnown = info !== null

      const emit = (
        variant: 'full' | 'half',
        amount: number,
        colIndex: number
      ) => {
        const key = `allocation_w:${code}:${variant}${condTag}`
        if (seenKeys.has(key)) return
        seenKeys.add(key)
        const amountCell = cellRef(r, colIndex)
        const variantFr = variant === 'full' ? 'allocation entière' : 'demi-allocation'
        const explanation =
          `Cette ligne provient de la feuille ${sheet.name} : le code ${code} est listé en ${codesCellRef} (ligne ${r + 1})` +
          (ageCondition && ageCondition !== '//' ? `, condition d'âge « ${ageCondition} »` : '') +
          `. Le montant journalier ${amount} (${variantFr}) a été lu en ${amountCell}.` +
          (isKnown
            ? ` Le code est reconnu via ${CODE_MAPPING_FILE}${info?.labelFr && !info.labelFr.startsWith('TODO') ? ` : ${info.labelFr}` : ''}.`
            : ` Le code n'est PAS mappé (absent de ${CODE_MAPPING_FILE}) — à vérifier.`) +
          (labelNl ? ` Libellé source : « ${labelNl} ».` : '')

        amounts.push({
          sourceSheet: sheet.name,
          category: 'allocation_w',
          allocationCode: code,
          salaryCode: variant,
          labelNl,
          labelFr:
            labelFr ?? (info?.labelFr && !info.labelFr.startsWith('TODO') ? info.labelFr : null),
          amount,
          unit: 'daily',
          validFrom: options.validFrom,
          comparisonKey: key,
          rawData: { ageCondition: ageCondition || undefined, row: r + 1 },
          status: isKnown ? 'valid' : 'unknown',
          warnings: isKnown ? [] : [`Code "${code}" non mappé — sémantique inconnue`],
          trace: {
            sourceCell: amountCell,
            sourceRowIndex: r + 1,
            sourceColumnIndex: colIndex + 1,
            rawValue: (row[colIndex] ?? '').trim(),
            normalizedValue: amount,
            mappingKey: code,
            mappingFile: isKnown ? CODE_MAPPING_FILE : null,
            transformTemplate: 'allocation_w',
            transformReason: explanation,
          },
        })
      }

      if (fullAmount !== null) emit('full', fullAmount, 15)
      if (halfAmount !== null) emit('half', halfAmount, 17)
    }
  }

  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucune allocation W extraite',
        sheet: sheet.name,
        reason: 'Aucune ligne avec codes (col M) et montants (col P/R) n\'a été trouvée — structure inattendue.',
        recommendation: 'Vérifier les colonnes M/P/R dans la grille brute ; adapter le parser allocation_w si la mise en page a changé.',
      })
    )
  }

  return { amounts, alerts, ignoredRows: [], unknownCodes }
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
