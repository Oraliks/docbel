import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeIgnoredRow,
  BaremeUnknownCode,
  ParserResult,
} from '../types'
import { makeIssue } from '../types'
import { parseBelgianDate } from '../normalize'
import {
  DEFAULT_SHEET_HANDLERS,
  SHEET_TEMPLATES_FILE,
  isSheetSupported,
  makeHandler,
  type ParserConfig,
  type ParserType,
  type SheetHandler,
} from '../sheet-templates'

// Réexports de compatibilité : les templates vivent dans sheet-templates.ts,
// les anciens imports `from './parsers'` continuent de fonctionner.
export { makeHandler, isSheetSupported }
export type { ParserConfig, ParserType, SheetHandler }
export { DEFAULT_SHEET_HANDLERS as SHEET_HANDLERS }

export interface DispatchResult extends ParserResult {
  parsedSheets: string[]
  ignoredSheets: { name: string; reason: string }[]
  ignoredRows: BaremeIgnoredRow[]
  unknownCodes: BaremeUnknownCode[]
  /** Date de validité détectée dans chaque feuille (cellule "Geldig/valable"). */
  sheetPeriods: { sheet: string; detectedDate: string | null; matchesFile: boolean | null }[]
  /** Feuilles parsées mais avec erreurs/warnings (traitement partiel). */
  partialSheets: { name: string; reason: string }[]
}

/**
 * Dispatche chaque onglet vers le bon parser et agrège les résultats.
 *
 * @param sheets — liste des feuilles brutes (sortie de parseBaremaFile)
 * @param validFrom — date de validité héritée du fichier
 * @param overrides — mappings personnalisés (BaremeSheetMapping) qui prennent
 *                    le pas sur les handlers par défaut. Clé = sheetName.
 */
export function dispatchParsers(
  sheets: ParsedSheet[],
  validFrom: Date | null,
  overrides: Record<string, SheetHandler> = {}
): DispatchResult {
  const handlers: Record<string, SheetHandler> = {
    ...DEFAULT_SHEET_HANDLERS,
    ...overrides,
  }

  const amounts: BaremeAmountDraft[] = []
  const alerts: BaremeAlert[] = []
  const parsedSheets: string[] = []
  const ignoredSheets: { name: string; reason: string }[] = []
  const ignoredRows: BaremeIgnoredRow[] = []
  const unknownCodes: BaremeUnknownCode[] = []
  const sheetPeriods: DispatchResult['sheetPeriods'] = []
  const partialSheets: { name: string; reason: string }[] = []

  for (const sheet of sheets) {
    // Date de validité propre à la feuille (les feuilles ONEM portent chacune
    // leur date sous "Geldig/valable" — elles peuvent légitimement différer
    // entre elles, ex: Bonus au 01/04 quand les allocations sont au 01/03).
    const sheetDate = detectSheetDate(sheet)
    const matchesFile =
      sheetDate && validFrom ? sheetDate.getTime() === validFrom.getTime() : null
    sheetPeriods.push({
      sheet: sheet.name,
      detectedDate: sheetDate ? sheetDate.toISOString().slice(0, 10) : null,
      matchesFile,
    })
    if (sheetDate && validFrom && sheetDate.getTime() !== validFrom.getTime()) {
      alerts.push(
        makeIssue({
          severity: 'info',
          kind: 'period_mismatch',
          title: 'Période propre à la feuille',
          sheet: sheet.name,
          reason: `La feuille indique une validité au ${formatDate(sheetDate)} alors que le fichier est importé pour le ${formatDate(validFrom)}. C'est fréquent chez l'ONEM (certaines feuilles changent à une autre date) mais à vérifier.`,
          recommendation:
            'Vérifier que la date de la feuille est cohérente avec la lettre ONEM accompagnant le fichier.',
        })
      )
    }

    const handler = handlers[sheet.name]
    if (!handler) {
      const reason = 'Aucun parser dédié pour cet onglet'
      ignoredSheets.push({ name: sheet.name, reason })
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'unknown_sheet',
          title: 'Feuille inconnue',
          sheet: sheet.name,
          reason: `L'onglet "${sheet.name}" (${sheet.rowCount} lignes) n'est associé à aucun template — aucune donnée n'en a été extraite.`,
          recommendation: `Ajouter un template dans ${SHEET_TEMPLATES_FILE} (ou un mapping dans /admin/baremes/mappings) si cette feuille doit être importée ; sa grille brute reste consultable dans le Diagnostic.`,
        })
      )
      continue
    }

    try {
      const result = handler.parse(sheet, { validFrom })
      amounts.push(...result.amounts)
      alerts.push(...result.alerts)
      if (result.ignoredRows?.length) ignoredRows.push(...result.ignoredRows)
      if (result.unknownCodes?.length) unknownCodes.push(...result.unknownCodes)
      parsedSheets.push(sheet.name)

      const sheetErrors = result.alerts.filter((a) => a.level === 'error')
      if (sheetErrors.length > 0 && result.amounts.length > 0) {
        partialSheets.push({
          name: sheet.name,
          reason: `${result.amounts.length} montants extraits malgré ${sheetErrors.length} erreur(s) — feuille traitée partiellement`,
        })
        alerts.push(
          makeIssue({
            severity: 'warning',
            kind: 'partial_sheet',
            title: 'Feuille traitée partiellement',
            sheet: sheet.name,
            reason: `${result.amounts.length} montants ont été extraits mais ${sheetErrors.length} erreur(s) de parsing ont été rencontrées sur cette feuille.`,
            recommendation:
              'Consulter les erreurs de la feuille dans l\'onglet "Erreurs & warnings" et vérifier la grille brute.',
          })
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'parser_error',
          title: 'Erreur du parser',
          sheet: sheet.name,
          reason: `Le parser "${handler.parserType}" a levé une exception : ${msg}. Aucune donnée extraite de cette feuille.`,
          recommendation: `Vérifier la structure de la feuille dans le Diagnostic (grille brute) ; adapter le parser ou le template dans ${SHEET_TEMPLATES_FILE}.`,
        })
      )
      ignoredSheets.push({ name: sheet.name, reason: `Erreur parser: ${msg}` })
    }
  }

  return {
    amounts,
    alerts,
    parsedSheets,
    ignoredSheets,
    ignoredRows,
    unknownCodes,
    sheetPeriods,
    partialSheets,
  }
}

/**
 * Détecte la date de validité affichée dans une feuille ONEM.
 * Convention : libellé "Geldig/valable" en haut de feuille, date dans les
 * premières lignes/colonnes (souvent A2). On scanne les 6 premières lignes.
 */
function detectSheetDate(sheet: ParsedSheet): Date | null {
  const maxRows = Math.min(6, sheet.cellData.length)
  for (let r = 0; r < maxRows; r++) {
    const row = sheet.cellData[r]
    const maxCols = Math.min(6, row.length)
    for (let c = 0; c < maxCols; c++) {
      const value = (row[c] ?? '').trim()
      if (!value) continue
      // Format affiché "1-3-2026" / "01-03-2026" / "2026-03-01" (cellDates)
      const be = parseBelgianDate(value)
      if (be) return be
      const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (iso) {
        const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
        if (!Number.isNaN(d.getTime())) return d
      }
    }
  }
  return null
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
