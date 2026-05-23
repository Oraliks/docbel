// Types partagés du module d'import de barèmes

export type BaremeAlertLevel = 'info' | 'warn' | 'error'

export interface BaremeAlert {
  level: BaremeAlertLevel
  sheet?: string
  cell?: string
  message: string
}

// Catégories de montants extraits — utilisées pour comparisonKey et grouping
export type BaremeCategory =
  | 'full_unemployment' // A_N_B_vol_plein : allocation chômage plein temps
  | 'half_unemployment' // A_N_B_half_demi : allocation chômage mi-temps
  | 'temporary_unemployment_full' // TW-CT_JS volle uitkering
  | 'temporary_unemployment_half' // TW-CT_JS halve uitkering
  | 'special_category_full' // SpecCat volle uitkering
  | 'special_category_half' // SpecCat halve uitkering
  | 'salary_bracket' // Loonschijven_Tranches salariale
  | 'hourly_wage' // Uurlonen_Salaires horaires
  | 'allocation_w' // W : insertion / sauvegarde
  | 'other_unemployment_amount' // AndereBedrWLH
  | 'activation' // Activering_Activation
  | 'other_allocation' // AndereUitk_AutresAlloc
  | 'employment_bonus' // Bonus
  | 'basic_amount' // Basisbedragen

// Brouillon de BaremeAmount produit par un parseur (avant insertion DB)
export interface BaremeAmountDraft {
  sourceSheet: string
  category: BaremeCategory
  allocationCode?: string | null
  salaryCode?: string | null
  article?: string | null
  labelFr?: string | null
  labelNl?: string | null
  unit?: string | null
  amount: number
  minDailySalary?: number | null
  maxDailySalary?: number | null
  validFrom?: Date | null
  rawData?: Record<string, unknown> | null
  comparisonKey: string
}

// Résultat d'un parseur individuel
export interface ParserResult {
  amounts: BaremeAmountDraft[]
  alerts: BaremeAlert[]
}

// Résumé global de l'import (stocké dans BaremeFile.summary)
export interface BaremeImportSummary {
  sheetsDetected: number
  sheetsParsed: number
  sheetsIgnored: number
  sheetsByName: { name: string; parsed: boolean; amountsCount: number; reason?: string }[]
  amountsExtracted: number
  // Renseignés après comparaison avec dernier import publié
  newEntries?: number
  modifiedEntries?: number
  removedEntries?: number
}

// Diff entre deux versions
export type BaremeDiffChange =
  | {
      type: 'amount_changed'
      key: string
      oldValue: number
      newValue: number
      category: string
      sourceSheet?: string
    }
  | {
      type: 'new_entry'
      key: string
      newValue: number
      category: string
      sourceSheet?: string
    }
  | {
      type: 'removed_entry'
      key: string
      oldValue: number
      category: string
      sourceSheet?: string
    }

export interface BaremeDiff {
  changes: BaremeDiffChange[]
  previousFileId: string | null
  newFileId: string
  countsByType: {
    amount_changed: number
    new_entry: number
    removed_entry: number
  }
}
