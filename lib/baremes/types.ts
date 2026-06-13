// Types partagés du module d'import de barèmes

export type BaremeAlertLevel = 'info' | 'warn' | 'error'

// Gravité enrichie (UI admin). 'critical' bloque la publication même avec force.
export type BaremeIssueSeverity = 'info' | 'warning' | 'error' | 'critical'

// Nature du problème — permet le filtrage et les suggestions de correction ciblées.
export type BaremeIssueKind =
  | 'unknown_sheet' // feuille sans parser configuré
  | 'ignored_sheet' // feuille volontairement ignorée
  | 'partial_sheet' // feuille traitée partiellement
  | 'unknown_code' // code ONEM non mappé (ni code-mapping.ts ni ignored-codes.ts)
  | 'unknown_column' // colonne non reconnue par le template
  | 'ignored_row' // ligne sautée pendant le parsing
  | 'invalid_amount' // montant non numérique / hors bornes
  | 'duplicate' // comparisonKey dupliquée
  | 'period_mismatch' // date de la feuille ≠ période du fichier
  | 'missing_period' // validFrom introuvable
  | 'parser_error' // exception dans un parser
  | 'anomaly' // variation anormale vs version précédente
  | 'validation' // échec de validation zod serveur
  | 'security' // problème de sécurité (type de fichier, taille…)
  | 'other'

/**
 * Alerte/issue d'import.
 *
 * Rétrocompatibilité : `level` + `message` restent les champs canoniques lus
 * par le workflow de publication et les anciens imports en DB. Les champs
 * enrichis (severity, title, reason, recommendation, …) sont optionnels et
 * alimentés par les nouveaux parsers. Utiliser `makeIssue()` pour construire
 * une alerte cohérente (level dérivé de severity automatiquement).
 */
export interface BaremeAlert {
  level: BaremeAlertLevel
  sheet?: string
  cell?: string
  message: string
  // — Champs enrichis (diagnostic admin, optionnels pour compat) —
  severity?: BaremeIssueSeverity
  kind?: BaremeIssueKind
  /** Titre court lisible (ex: "Code ONEM non mappé"). */
  title?: string
  /** Ligne Excel 1-based. */
  row?: number
  /** Lettre de colonne Excel (ex: "H"). */
  column?: string
  /** Valeur brute de la cellule concernée. */
  rawValue?: string
  /** Explication détaillée du problème. */
  reason?: string
  /** Action recommandée (ex: "ajouter AFoud dans code-mapping.ts"). */
  recommendation?: string
}

const SEVERITY_TO_LEVEL: Record<BaremeIssueSeverity, BaremeAlertLevel> = {
  info: 'info',
  warning: 'warn',
  error: 'error',
  critical: 'error',
}

export interface MakeIssueInput {
  severity: BaremeIssueSeverity
  kind: BaremeIssueKind
  title: string
  reason: string
  sheet?: string
  cell?: string
  row?: number
  column?: string
  rawValue?: string
  recommendation?: string
}

/** Construit une BaremeAlert enrichie avec level/message legacy dérivés. */
export function makeIssue(input: MakeIssueInput): BaremeAlert {
  return {
    level: SEVERITY_TO_LEVEL[input.severity],
    message: input.title === input.reason ? input.reason : `${input.title} — ${input.reason}`,
    sheet: input.sheet,
    cell: input.cell,
    severity: input.severity,
    kind: input.kind,
    title: input.title,
    row: input.row,
    column: input.column,
    rawValue: input.rawValue,
    reason: input.reason,
    recommendation: input.recommendation,
  }
}

/** Gravité effective d'une alerte (mappe les anciens imports sans severity). */
export function issueSeverity(alert: BaremeAlert): BaremeIssueSeverity {
  if (alert.severity) return alert.severity
  if (alert.level === 'warn') return 'warning'
  return alert.level
}

/** Vrai si l'alerte bloque la publication/export (error ou critical). */
export function isBlockingIssue(alert: BaremeAlert): boolean {
  const s = issueSeverity(alert)
  return s === 'error' || s === 'critical'
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

// Groupes d'export CSV (un CSV normalisé par groupe)
export type BaremeExportGroup = 'allocations' | 'tranches' | 'montants-base'

export const CATEGORY_EXPORT_GROUP: Record<BaremeCategory, BaremeExportGroup> = {
  full_unemployment: 'allocations',
  half_unemployment: 'allocations',
  temporary_unemployment_full: 'allocations',
  temporary_unemployment_half: 'allocations',
  special_category_full: 'allocations',
  special_category_half: 'allocations',
  allocation_w: 'allocations',
  salary_bracket: 'tranches',
  hourly_wage: 'tranches',
  other_unemployment_amount: 'montants-base',
  activation: 'montants-base',
  other_allocation: 'montants-base',
  employment_bonus: 'montants-base',
  basic_amount: 'montants-base',
}

// Statut d'une ligne extraite (affiché en badge dans la preview admin)
export type BaremeRowStatus = 'valid' | 'warning' | 'ignored' | 'error' | 'unknown'

/**
 * Trace d'origine d'une ligne extraite. Persistée dans BaremeAmount.rawData
 * (jamais exportée dans les CSV publics) — répond à « d'où vient ce montant ? ».
 */
export interface BaremeRowTrace {
  /** Cellule Excel du montant (ex: "H14"). */
  sourceCell: string
  /** Ligne Excel 1-based. */
  sourceRowIndex: number
  /** Colonne Excel 1-based (A=1). */
  sourceColumnIndex: number
  /** Valeur brute lue dans la cellule. */
  rawValue: string
  /** Valeur après normalisation (nombre parsé). */
  normalizedValue: number | string | null
  /** Clé de mapping appliquée (ex: code ONEM "AA1"). */
  mappingKey?: string | null
  /** Fichier/source du mapping ('code-mapping.ts', 'sheet-templates.ts', 'BaremeSheetMapping (DB)'…). */
  mappingFile?: string | null
  /** Template/parser appliqué (ex: 'allocation_matrix'). */
  transformTemplate?: string | null
  /** Explication humaine complète de la provenance (tooltip admin). */
  transformReason?: string | null
  /** Taux d'indemnisation affiché en en-tête de colonne (0.65 / 0.60), si présent. */
  rate?: number | null
}

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
  // — Traçabilité (persistée dans rawData à l'insertion) —
  trace?: BaremeRowTrace
  status?: BaremeRowStatus
  warnings?: string[]
}

// Ligne ignorée pendant le parsing (diagnostic admin)
export interface BaremeIgnoredRow {
  sheet: string
  /** Ligne Excel 1-based. */
  rowIndex: number
  /** Premières cellules de la ligne (tronquées pour la preview). */
  rawValues: string[]
  reason: string
}

// Code ONEM rencontré mais absent de code-mapping.ts et ignored-codes.ts
export interface BaremeUnknownCode {
  sheet: string
  cell: string
  code: string
  category?: string
  /** Suggestion de correction côté code. */
  recommendation?: string
}

// Résultat d'un parseur individuel
export interface ParserResult {
  amounts: BaremeAmountDraft[]
  alerts: BaremeAlert[]
  ignoredRows?: BaremeIgnoredRow[]
  unknownCodes?: BaremeUnknownCode[]
}

// Diagnostics complets d'un import (persistés dans BaremeFile.diagnostics)
export interface BaremeDiagnostics {
  fileSize: number
  unknownCodes: BaremeUnknownCode[]
  ignoredRows: BaremeIgnoredRow[]
  unsupportedSheets: { name: string; reason: string; rowCount?: number }[]
  partialSheets: { name: string; reason: string }[]
  /** Date de validité détectée par feuille vs validFrom du fichier. */
  sheetPeriods: { sheet: string; detectedDate: string | null; matchesFile: boolean | null }[]
  duplicates: { comparisonKey: string; count: number; droppedCells: string[] }[]
  /** Lignes ignorées tronquées ? (cap de stockage atteint) */
  ignoredRowsTruncated?: boolean
  /** Vérification round-trip (chaque montant relié à sa cellule source). */
  roundTrip?: {
    checked: number
    direct: number
    derived: number
    noTrace: number
    mismatches: number
  }
  /** Résultats des contrats de structure par feuille. */
  contracts?: {
    sheet: string
    present: boolean
    actualCount: number
    expectedCount: number
    status: string
  }[]
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

/** Conversion index colonne 0-based → lettres Excel (0→A, 25→Z, 26→AA, …). */
export function columnLetter(colIndex0: number): string {
  let n = colIndex0
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

/** Référence de cellule Excel depuis indices 0-based (r=13,c=7 → "H14"). */
export function cellRef(rowIndex0: number, colIndex0: number): string {
  return `${columnLetter(colIndex0)}${rowIndex0 + 1}`
}
