import type { ParsedBaremaData } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeDiagnostics,
  BaremeImportSummary,
} from './types'
import { makeIssue } from './types'
import { dispatchParsers, type SheetHandler } from './parsers'
import { parseBelgianDate } from './normalize'

// Bornes de plausibilité d'un montant ONEM (EUR). Au-delà → invalid_amount.
const AMOUNT_MIN = 0
const AMOUNT_MAX = 100_000

// Cap de stockage des lignes ignorées dans les diagnostics (évite un JSON énorme)
const MAX_IGNORED_ROWS = 500

export interface NormalizedBaremeImport {
  amounts: BaremeAmountDraft[]
  alerts: BaremeAlert[]
  summary: BaremeImportSummary
  validFrom: Date | null
  diagnostics: Omit<BaremeDiagnostics, 'fileSize'>
}

/**
 * Transforme les données brutes d'un workbook (sortie de parseBaremaFile)
 * en montants normalisés + alertes + résumé + diagnostics.
 *
 * Le validFrom passé en argument prime sur celui éventuellement détecté dans
 * le fichier (cf. extractValidFromFileName côté importBaremeFile).
 *
 * Les `parserOverrides` (issus de BaremeSheetMapping) ont précédence sur les
 * handlers par défaut, permettant d'absorber un changement de structure ONEM
 * sans nouveau déploiement.
 *
 * Validations serveur strictes appliquées ici :
 *  - validFrom obligatoire (issue error si introuvable — jamais deviné) ;
 *  - montants finis et dans des bornes plausibles ;
 *  - comparisonKey uniques (doublons dédupliqués + issue) ;
 *  - feuilles supportées ou explicitement signalées.
 */
export function normalizeBaremeData(
  parsed: ParsedBaremaData,
  validFromOverride: Date | null,
  parserOverrides: Record<string, SheetHandler> = {}
): NormalizedBaremeImport {
  // Priorité du validFrom :
  //   1. override (typiquement extrait du nom de fichier)
  //   2. métadata détectée par lib/baremes-parser.ts (effectiveDate)
  //   3. null → erreur bloquante (on ne devine jamais une période légale)
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

  const alerts = [...dispatch.alerts]

  // — Validation : montants plausibles —
  const boundedAmounts: BaremeAmountDraft[] = []
  for (const draft of dispatch.amounts) {
    if (!Number.isFinite(draft.amount) || draft.amount < AMOUNT_MIN || draft.amount > AMOUNT_MAX) {
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'invalid_amount',
          title: 'Montant hors bornes',
          sheet: draft.sourceSheet,
          cell: draft.trace?.sourceCell,
          rawValue: draft.trace?.rawValue,
          reason: `Le montant ${draft.amount} (${draft.comparisonKey}) est hors des bornes plausibles [${AMOUNT_MIN}, ${AMOUNT_MAX}] — ligne écartée.`,
          recommendation: 'Vérifier la cellule source : erreur de saisie ONEM ou parsing décalé.',
        })
      )
      continue
    }
    boundedAmounts.push(draft)
  }

  // — Validation : comparisonKey uniques (dédup en gardant la 1ère occurrence) —
  const byKey = new Map<string, BaremeAmountDraft>()
  const duplicates = new Map<string, { count: number; droppedCells: string[] }>()
  for (const draft of boundedAmounts) {
    const existing = byKey.get(draft.comparisonKey)
    if (!existing) {
      byKey.set(draft.comparisonKey, draft)
      continue
    }
    const dup = duplicates.get(draft.comparisonKey) ?? { count: 1, droppedCells: [] }
    dup.count++
    if (draft.trace?.sourceCell) dup.droppedCells.push(`${draft.sourceSheet}!${draft.trace.sourceCell}`)
    duplicates.set(draft.comparisonKey, dup)
    // La 1ère occurrence gagne ; on marque quand même son statut
    if (existing.status === 'valid') existing.status = 'warning'
    existing.warnings = [
      ...(existing.warnings ?? []),
      `Clé dupliquée : ${dup.count} occurrences dans le fichier — seule celle-ci est conservée`,
    ]
  }
  const amounts = [...byKey.values()]

  // Une seule issue agrégée pour les doublons (le détail par clé vit dans
  // diagnostics.duplicates) — sinon un défaut structurel répété noierait
  // l'onglet Erreurs sous des centaines d'entrées identiques.
  if (duplicates.size > 0) {
    const totalDropped = [...duplicates.values()].reduce((s, d) => s + d.count - 1, 0)
    const examples = [...duplicates.keys()].slice(0, 5).join(', ')
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'duplicate',
        title: 'Doublons de clés de comparaison',
        reason: `${duplicates.size} clé(s) apparaissent plusieurs fois (${totalDropped} ligne(s) écartée(s), seule la première occurrence est conservée). Exemples : ${examples}${duplicates.size > 5 ? '…' : ''}. Détail complet dans le Diagnostic.`,
        recommendation:
          'Si plusieurs occurrences sont légitimes, la clé de comparaison du parser concerné doit être affinée (voir sheet-templates.ts).',
      })
    )
  }

  const summary: BaremeImportSummary = {
    sheetsDetected: parsed.sheets.length,
    sheetsParsed: dispatch.parsedSheets.length,
    sheetsIgnored: dispatch.ignoredSheets.length,
    sheetsByName,
    amountsExtracted: amounts.length,
  }

  // — Validation : période obligatoire —
  if (!validFrom) {
    alerts.unshift(
      makeIssue({
        severity: 'error',
        kind: 'missing_period',
        title: 'Date de validité introuvable',
        reason:
          "Aucune date de validité (validFrom) n'a pu être déterminée — ni dans le nom du fichier, ni dans les métadonnées du classeur. La période est obligatoire : on ne publie jamais un barème sans date d'effet.",
        recommendation:
          'Renommer le fichier au format "barema-new-DDMMYYYY.xlsx" (ex: barema-new-01042026.xlsx) et réimporter.',
      })
    )
  }

  const ignoredRowsTruncated = dispatch.ignoredRows.length > MAX_IGNORED_ROWS
  const diagnostics: Omit<BaremeDiagnostics, 'fileSize'> = {
    unknownCodes: dispatch.unknownCodes,
    ignoredRows: dispatch.ignoredRows.slice(0, MAX_IGNORED_ROWS),
    unsupportedSheets: dispatch.ignoredSheets.map((s) => {
      const sheet = parsed.sheets.find((x) => x.name === s.name)
      return { name: s.name, reason: s.reason, rowCount: sheet?.rowCount }
    }),
    partialSheets: dispatch.partialSheets,
    sheetPeriods: dispatch.sheetPeriods,
    duplicates: [...duplicates.entries()].map(([comparisonKey, d]) => ({
      comparisonKey,
      count: d.count,
      droppedCells: d.droppedCells.slice(0, 10),
    })),
    ignoredRowsTruncated: ignoredRowsTruncated || undefined,
  }

  return {
    amounts,
    alerts,
    summary,
    validFrom,
    diagnostics,
  }
}
