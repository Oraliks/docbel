import type { ParsedBaremaData } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, BaremeImportSummary } from './types'
import { dispatchParsers, type SheetHandler } from './parsers'
import { parseBelgianDate } from './normalize'

export interface NormalizedBaremeImport {
  amounts: BaremeAmountDraft[]
  alerts: BaremeAlert[]
  summary: BaremeImportSummary
  validFrom: Date | null
}

/**
 * Transforme les données brutes d'un workbook (sortie de parseBaremaFile)
 * en montants normalisés + alertes + résumé.
 *
 * Le validFrom passé en argument prime sur celui éventuellement détecté dans
 * le fichier (cf. extractValidFromFileName côté importBaremeFile).
 *
 * Les `parserOverrides` (issus de BaremeSheetMapping) ont précédence sur les
 * handlers par défaut, permettant d'absorber un changement de structure ONEM
 * sans nouveau déploiement.
 */
export function normalizeBaremeData(
  parsed: ParsedBaremaData,
  validFromOverride: Date | null,
  parserOverrides: Record<string, SheetHandler> = {}
): NormalizedBaremeImport {
  // Priorité du validFrom :
  //   1. override (typiquement extrait du nom de fichier)
  //   2. métadata détectée par lib/baremes-parser.ts (effectiveDate)
  //   3. null → alerte
  const validFrom =
    validFromOverride ??
    parseBelgianDate(parsed.fileMetadata.effectiveDate) ??
    null

  const dispatch = dispatchParsers(parsed.sheets, validFrom, parserOverrides)

  const sheetsByName = parsed.sheets.map((s) => {
    const isParsed = dispatch.parsedSheets.includes(s.name)
    const ignored = dispatch.ignoredSheets.find((i) => i.name === s.name)
    const amountsCount = dispatch.amounts.filter((a) => a.sourceSheet === s.name).length
    return {
      name: s.name,
      parsed: isParsed,
      amountsCount,
      reason: ignored?.reason,
    }
  })

  const summary: BaremeImportSummary = {
    sheetsDetected: parsed.sheets.length,
    sheetsParsed: dispatch.parsedSheets.length,
    sheetsIgnored: dispatch.ignoredSheets.length,
    sheetsByName,
    amountsExtracted: dispatch.amounts.length,
  }

  const alerts = [...dispatch.alerts]

  if (!validFrom) {
    alerts.unshift({
      level: 'warn',
      message: 'Date de validité introuvable — vérifier le nom de fichier ou la cellule date du fichier',
    })
  }

  return {
    amounts: dispatch.amounts,
    alerts,
    summary,
    validFrom,
  }
}
