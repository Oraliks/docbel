import { prisma, withDbRetry } from '@/lib/prisma'
import type { BaremeCategory } from './types'
import { makeHandler, type ParserType, type SheetHandler } from './parsers'

/**
 * Charge les BaremeSheetMapping actifs depuis la DB et les transforme en
 * SheetHandler indexés par sheetName, prêts à être passés à dispatchParsers.
 *
 * Stratégie : pour chaque mapping enabled, on construit un handler avec le
 * parserType et la category configurés. La structure spécifique (config) est
 * passée comme paramètre dans le futur (V2.1) — pour V2 on se contente du
 * routage parserType+category, ce qui couvre déjà 80% des cas (ex: forcer
 * SpecCat à utiliser allocation_matrix avec une nouvelle category).
 */
export async function loadSheetMappingOverrides(
  fileType: string = 'onem-rates'
): Promise<Record<string, SheetHandler>> {
  const mappings = await withDbRetry(() =>
    prisma.baremeSheetMapping.findMany({
      where: { fileType, enabled: true },
    })
  )

  const overrides: Record<string, SheetHandler> = {}
  for (const m of mappings) {
    try {
      overrides[m.sheetName] = makeHandler({
        parserType: m.parserType as ParserType,
        category: m.category as BaremeCategory,
      })
    } catch (err) {
      console.warn(
        `[loadSheetMappings] Mapping invalide pour ${m.sheetName}: ${err instanceof Error ? err.message : err}`
      )
    }
  }

  return overrides
}
