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
 *  - comparisonKey uniques (collisions conservées + issue) ;
 *  - feuilles supportées ou explicitement signalées.
 */
export function normalizeBaremeData(
  parsed: ParsedBaremaData,
  validFromOverride: Date | null,
  parserOverrides: Record<string, SheetHandler> = {}
): NormalizedBaremeImport {
  // validFrom AU NIVEAU FICHIER (marqueur de publication / batch) :
  //   1. override (typiquement extrait du nom de fichier)
  //   2. métadata détectée par lib/baremes-parser.ts (effectiveDate)
  // NB : chaque feuille porte sa propre date "Geldig/valable" — c'est elle qui
  // date les montants (cf. dispatchParsers). Le validFrom fichier ne sert qu'au
  // record BaremeFile et au contrôle "période obligatoire".
  const fileValidFrom =
    validFromOverride ??
    parseBelgianDate(parsed.fileMetadata.effectiveDate) ??
    null

  const dispatch = dispatchParsers(parsed.sheets, fileValidFrom, parserOverrides)

  // Si ni le nom de fichier ni la métadata ne donnent de date, on retombe sur la
  // date de feuille la plus récente (les feuilles ONEM la portent toujours) —
  // on ne devine jamais, on lit une date réellement présente dans le fichier.
  const detectedSheetDates = dispatch.sheetPeriods
    .map((p) => p.detectedDate)
    .filter((d): d is string => !!d)
    .sort()
  const latestSheetDate = detectedSheetDates.at(-1)
  const validFrom =
    fileValidFrom ??
    (latestSheetDate ? new Date(`${latestSheetDate}T00:00:00.000Z`) : null)

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
  const collidingAmounts: BaremeAmountDraft[] = []
  const duplicates = new Map<string, { count: number; cells: string[] }>()
  for (const draft of boundedAmounts) {
    const existing = byKey.get(draft.comparisonKey)
    if (!existing) {
      byKey.set(draft.comparisonKey, draft)
      continue
    }
    const dup = duplicates.get(draft.comparisonKey) ?? { count: 1, cells: [] }
    dup.count++
    if (existing.trace?.sourceCell && dup.cells.length === 0) dup.cells.push(`${existing.sourceSheet}!${existing.trace.sourceCell}`)
    if (draft.trace?.sourceCell) dup.cells.push(`${draft.sourceSheet}!${draft.trace.sourceCell}`)
    duplicates.set(draft.comparisonKey, dup)
    // Ne choisir aucune occurrence arbitrairement : conserver chaque ligne afin
    // que la comparaison signale l'identité ambiguë et que la revue puisse ouvrir les sources.
    if (existing.status !== 'error') existing.status = 'warning'
    existing.warnings = [
      ...(existing.warnings ?? []),
      `Clé dupliquée : ${dup.count} occurrences dans le fichier — identité à résoudre`,
    ]
    draft.status = 'warning'
    draft.warnings = [...(draft.warnings ?? []), `Clé dupliquée : ${dup.count} occurrences dans le fichier — identité à résoudre`]
    collidingAmounts.push(draft)
  }
  const amounts = [...byKey.values(), ...collidingAmounts]

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
        reason: `${duplicates.size} clé(s) apparaissent plusieurs fois (${totalDropped} ligne(s) en collision). Aucune occurrence n'est choisie pour la comparaison. Exemples : ${examples}${duplicates.size > 5 ? '…' : ''}. Détail complet dans le Diagnostic.`,
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
    duplicates: [...duplicates.entries()].map(([comparisonKey, d]) => ({ comparisonKey, count: d.count, droppedCells: [] })),
    collisions: [...duplicates.entries()].map(([comparisonKey, d]) => ({ comparisonKey, count: d.count, cells: d.cells.slice(0, 20) })),
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
