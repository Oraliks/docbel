import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeCategory,
  ParserResult,
} from '../types'
import { parseAllocationMatrix } from './parseAllocationMatrix'
import { parseSalaryBrackets } from './parseSalaryBrackets'
import { parseBasicAmounts } from './parseBasicAmounts'
import { parseHourlyWages } from './parseHourlyWages'
import { parseAllocationW } from './parseAllocationW'
import { parseOtherUnemploymentAmounts } from './parseOtherUnemploymentAmounts'
import { parseActivation } from './parseActivation'
import { parseOtherAllocations } from './parseOtherAllocations'
import { parseEmploymentBonus } from './parseEmploymentBonus'

export type ParserType =
  | 'allocation_matrix'
  | 'salary_brackets'
  | 'basic_amounts'
  | 'hourly_wages'
  | 'allocation_w'
  | 'other_unemployment_amounts'
  | 'activation'
  | 'other_allocations'
  | 'employment_bonus'

export interface ParserConfig {
  parserType: ParserType
  category: BaremeCategory
  // Pour le parser de matrice (allocation_matrix) : autorise plusieurs catégories
  // selon que c'est plein temps, mi-temps, etc. La catégorie ci-dessus est utilisée.
}

export interface SheetHandler extends ParserConfig {
  parse: (sheet: ParsedSheet, opts: { validFrom: Date | null }) => ParserResult
}

function makeHandler(config: ParserConfig): SheetHandler {
  const { parserType, category } = config
  switch (parserType) {
    case 'allocation_matrix':
      return {
        ...config,
        parse: (sheet, opts) =>
          parseAllocationMatrix(sheet, { category, validFrom: opts.validFrom }),
      }
    case 'salary_brackets':
      return { ...config, parse: (sheet, opts) => parseSalaryBrackets(sheet, opts) }
    case 'basic_amounts':
      return { ...config, parse: (sheet, opts) => parseBasicAmounts(sheet, opts) }
    case 'hourly_wages':
      return { ...config, parse: (sheet, opts) => parseHourlyWages(sheet, opts) }
    case 'allocation_w':
      return { ...config, parse: (sheet, opts) => parseAllocationW(sheet, opts) }
    case 'other_unemployment_amounts':
      return {
        ...config,
        parse: (sheet, opts) => parseOtherUnemploymentAmounts(sheet, opts),
      }
    case 'activation':
      return { ...config, parse: (sheet, opts) => parseActivation(sheet, opts) }
    case 'other_allocations':
      return { ...config, parse: (sheet, opts) => parseOtherAllocations(sheet, opts) }
    case 'employment_bonus':
      return { ...config, parse: (sheet, opts) => parseEmploymentBonus(sheet, opts) }
  }
}

// Mapping par défaut nom d'onglet → config parser.
// Peut être overridé via BaremeSheetMapping (loadOverrides).
const DEFAULT_SHEET_HANDLERS: Record<string, SheetHandler> = {
  A_N_B_vol_plein: makeHandler({ parserType: 'allocation_matrix', category: 'full_unemployment' }),
  A_N_B_half_demi: makeHandler({ parserType: 'allocation_matrix', category: 'half_unemployment' }),
  'TW-CT_JS': makeHandler({
    parserType: 'allocation_matrix',
    category: 'temporary_unemployment_full',
  }),
  SpecCat: makeHandler({
    parserType: 'allocation_matrix',
    category: 'special_category_full',
  }),
  'Loonschijven_Tranches salariale': makeHandler({
    parserType: 'salary_brackets',
    category: 'salary_bracket',
  }),
  'Uurlonen_Salaires horaires': makeHandler({
    parserType: 'hourly_wages',
    category: 'hourly_wage',
  }),
  'W ': makeHandler({ parserType: 'allocation_w', category: 'allocation_w' }),
  AndereBedrWLH_AutresMontCHOM: makeHandler({
    parserType: 'other_unemployment_amounts',
    category: 'other_unemployment_amount',
  }),
  Activering_Activation: makeHandler({ parserType: 'activation', category: 'activation' }),
  AndereUitk_AutresAlloc: makeHandler({
    parserType: 'other_allocations',
    category: 'other_allocation',
  }),
  Bonus: makeHandler({ parserType: 'employment_bonus', category: 'employment_bonus' }),
  Basisbedragen: makeHandler({ parserType: 'basic_amounts', category: 'basic_amount' }),
}

export interface DispatchResult extends ParserResult {
  parsedSheets: string[]
  ignoredSheets: { name: string; reason: string }[]
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

  for (const sheet of sheets) {
    const handler = handlers[sheet.name]
    if (!handler) {
      ignoredSheets.push({ name: sheet.name, reason: 'Aucun parser dédié' })
      alerts.push({
        level: 'info',
        sheet: sheet.name,
        message: `Onglet non géré (parser à configurer)`,
      })
      continue
    }

    try {
      const result = handler.parse(sheet, { validFrom })
      amounts.push(...result.amounts)
      alerts.push(...result.alerts)
      parsedSheets.push(sheet.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alerts.push({
        level: 'error',
        sheet: sheet.name,
        message: `Erreur dans le parser: ${msg}`,
      })
      ignoredSheets.push({ name: sheet.name, reason: `Erreur parser: ${msg}` })
    }
  }

  return { amounts, alerts, parsedSheets, ignoredSheets }
}

export function isSheetSupported(sheetName: string): boolean {
  return sheetName in DEFAULT_SHEET_HANDLERS
}

export { DEFAULT_SHEET_HANDLERS as SHEET_HANDLERS, makeHandler }
