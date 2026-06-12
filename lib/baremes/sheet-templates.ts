// Templates de feuilles : mapping nom d'onglet ONEM → parser + catégorie.
//
// C'est ici qu'on déclare comment chaque feuille du classeur ONEM est
// transformée en montants normalisés. Pour absorber un changement de structure
// sans redéploiement, un override DB existe aussi (BaremeSheetMapping, géré
// dans /admin/baremes/mappings) et prend le pas sur ces défauts.
//
// Ajouter une feuille : créer (ou réutiliser) un parser dans ./parsers/,
// déclarer l'entrée dans DEFAULT_SHEET_HANDLERS ci-dessous.

import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeCategory, ParserResult } from './types'
import { parseAllocationMatrix } from './parsers/parseAllocationMatrix'
import { parseSalaryBrackets } from './parsers/parseSalaryBrackets'
import { parseBasicAmounts } from './parsers/parseBasicAmounts'
import { parseHourlyWages } from './parsers/parseHourlyWages'
import { parseAllocationW } from './parsers/parseAllocationW'
import { parseOtherUnemploymentAmounts } from './parsers/parseOtherUnemploymentAmounts'
import { parseActivation } from './parsers/parseActivation'
import { parseOtherAllocations } from './parsers/parseOtherAllocations'
import { parseEmploymentBonus } from './parsers/parseEmploymentBonus'

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

export function makeHandler(config: ParserConfig): SheetHandler {
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
// Peut être overridé via BaremeSheetMapping (loadSheetMappingOverrides).
export const DEFAULT_SHEET_HANDLERS: Record<string, SheetHandler> = {
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

export function isSheetSupported(sheetName: string): boolean {
  return sheetName in DEFAULT_SHEET_HANDLERS
}

/** Fichier à citer dans les recommandations du diagnostic. */
export const SHEET_TEMPLATES_FILE = 'lib/baremes/sheet-templates.ts'
