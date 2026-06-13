import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { parseBaremaFile } from '@/lib/baremes-parser'
import { sha256 } from './hash'
import { normalizeBaremeData } from './normalizeBaremeData'
import { verifyRoundTrip } from './verifyRoundTrip'
import { verifySheetContracts } from './sheetContracts'
import { verifyCoverage } from './verifyCoverage'
import { verifyInvariants } from './verifyInvariants'
import { extractValidFromFileName } from './normalize'
import { compareBaremeVersions, detectAnomaliesFromDiff } from './compareBaremeVersions'
import { loadSheetMappingOverrides } from './loadSheetMappings'
import { logPublicationEvent } from './publicationLog'
import {
  CATEGORY_EXPORT_GROUP,
  isBlockingIssue,
  makeIssue,
  type BaremeAlert,
  type BaremeAmountDraft,
  type BaremeDiagnostics,
  type BaremeImportSummary,
} from './types'

// Stockage PRIVÉ : jamais sous public/ — le fichier source n'est servi que via
// la route authentifiée /api/baremes/import/[id]/source.
const PRIVATE_UPLOAD_SUBDIR = path.join('private', 'uploads', 'baremes')

export interface ImportBaremeInput {
  buffer: ArrayBuffer | Buffer
  fileName: string
  /** Identité loggée dans BaremeFile.createdBy + activity (typiquement email). */
  createdBy?: string
  /** Active le workflow 4 yeux pour cet import (double approbation requise avant publish). */
  requiresApproval?: boolean
}

export type ImportBaremeResult =
  | {
      status: 'created'
      fileId: string
      summary: BaremeImportSummary
      alerts: BaremeAlert[]
      validFrom: Date | null
      /** Export CSV/publication autorisés (aucune issue error/critical). */
      exportAllowed: boolean
    }
  | {
      status: 'duplicate'
      fileId: string
      message: string
    }

// Validation serveur stricte de chaque montant avant insertion.
// La preview admin valide visuellement ; ceci est la barrière finale.
const amountDraftSchema = z.object({
  sourceSheet: z.string().min(1).max(200),
  category: z.enum(Object.keys(CATEGORY_EXPORT_GROUP) as [string, ...string[]]),
  allocationCode: z.string().max(60).nullish(),
  salaryCode: z.string().max(60).nullish(),
  article: z.string().max(300).nullish(),
  labelFr: z.string().max(500).nullish(),
  labelNl: z.string().max(500).nullish(),
  unit: z.string().max(30).nullish(),
  amount: z.number().finite(),
  minDailySalary: z.number().finite().nullish(),
  maxDailySalary: z.number().finite().nullish(),
  comparisonKey: z.string().min(3).max(200),
})

/**
 * Pipeline complet d'import d'un fichier .xlsx de barèmes.
 *
 *  1. Calcule sha256 du fichier
 *  2. Vérifie l'absence d'un BaremeFile avec le même hash (dedup)
 *  3. Lit le workbook (parseBaremaFile : valeurs calculées uniquement, aucune
 *     macro exécutée, aucune formule évaluée)
 *  4. Dispatche vers les parsers dédiés (normalizeBaremeData) + validation zod
 *  5. Sauvegarde le fichier dans private/ (jamais accessible publiquement)
 *  6. Insère BaremeFile (status="draft") + BaremeAmount[] (avec trace) en transaction
 *  7. Crée aussi les BareSheet (vue grille brute) pour le diagnostic
 */
export async function importBaremeFile(
  input: ImportBaremeInput
): Promise<ImportBaremeResult> {
  if (!input.fileName.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Seuls les fichiers .xlsx sont acceptés')
  }

  const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer)
  const fileHash = sha256(buffer)
  const fileSize = buffer.byteLength

  // 1) Dedup par hash
  const existing = await withDbRetry(() =>
    prisma.baremeFile.findUnique({
      where: { fileHash },
      select: { id: true, status: true, name: true },
    })
  )
  if (existing) {
    return {
      status: 'duplicate',
      fileId: existing.id,
      message: `Fichier déjà importé sous "${existing.name}" (status: ${existing.status})`,
    }
  }

  // 2) Parse Excel
  const parsed = parseBaremaFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer)

  // 3) Charger les overrides de mapping et normaliser
  const validFromFromName = extractValidFromFileName(input.fileName)
  const overrides = await loadSheetMappingOverrides('onem-rates').catch(() => ({}))
  const normalized = normalizeBaremeData(parsed, validFromFromName, overrides)

  // 3bis) Validation zod finale des drafts — un draft invalide est écarté avec issue
  const validatedAmounts: BaremeAmountDraft[] = []
  for (const draft of normalized.amounts) {
    const check = amountDraftSchema.safeParse(draft)
    if (!check.success) {
      normalized.alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'validation',
          title: 'Ligne rejetée par la validation serveur',
          sheet: draft.sourceSheet,
          cell: draft.trace?.sourceCell,
          rawValue: draft.trace?.rawValue,
          reason: `La ligne "${draft.comparisonKey}" ne passe pas la validation : ${check.error.issues[0]?.message ?? 'données invalides'}.`,
          recommendation: 'Bug probable du parser — vérifier la cellule source dans le Diagnostic.',
        })
      )
      continue
    }
    validatedAmounts.push(draft)
  }
  normalized.summary.amountsExtracted = validatedAmounts.length

  // 3ter) Round-trip : chaque montant doit être rattaché à sa cellule source réelle
  // (preuve qu'aucun montant n'est copié/décalé/inventé). Tout mismatch = bloquant.
  const roundTrip = verifyRoundTrip(parsed.sheets, validatedAmounts)
  normalized.alerts.push(...roundTrip.alerts)

  // 3quater) Contrats de structure : feuille attendue présente, bonne catégorie,
  // compte plausible, codes-clés présents — détecte une dérive du fichier ONEM.
  const contracts = verifySheetContracts(parsed.sheets, validatedAmounts)
  normalized.alerts.push(...contracts.alerts)

  // 3quinquies) Couverture inverse (feuilles denses) : aucune cellule montant de la
  // zone de données n'est oubliée (anti-perte silencieuse).
  const coverage = verifyCoverage(parsed.sheets, validatedAmounts, normalized.diagnostics.ignoredRows)
  normalized.alerts.push(...coverage.alerts)

  // 3sexies) Invariants SÉMANTIQUES : sentinelles (code↔colonne), ordres par tranche,
  // half=plein/2, monotonie, bornes de plausibilité — la justesse, pas que la présence.
  const invariants = verifyInvariants(validatedAmounts)
  normalized.alerts.push(...invariants.alerts)

  // 4) Sauvegarde disque — répertoire PRIVÉ
  const uploadDir = path.join(/* turbopackIgnore: true */ process.cwd(), PRIVATE_UPLOAD_SUBDIR)
  const safeName = sanitizeFileName(input.fileName)
  const storedName = `${Date.now()}-${safeName}`
  let storedPath: string | null = null
  try {
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, storedName), buffer)
    storedPath = path.posix.join('private/uploads/baremes', storedName)
  } catch (err) {
    // FS read-only (serverless) : l'import continue, le fichier source n'est
    // simplement pas re-téléchargeable. Les données extraites sont en DB.
    console.warn('[importBaremeFile] stockage du fichier source impossible:', err)
    normalized.alerts.push(
      makeIssue({
        severity: 'info',
        kind: 'other',
        title: 'Fichier source non conservé',
        reason: 'Le système de fichiers est en lecture seule — le .xlsx source ne sera pas re-téléchargeable depuis l\'admin. Les données extraites sont en base.',
      })
    )
  }

  const diagnostics: BaremeDiagnostics = {
    fileSize,
    ...normalized.diagnostics,
    roundTrip: {
      checked: roundTrip.checked,
      direct: roundTrip.direct,
      derived: roundTrip.derived,
      noTrace: roundTrip.noTrace,
      mismatches: roundTrip.mismatches,
    },
    contracts: contracts.results,
  }

  // 5) Préparation des lignes HORS transaction (pur CPU — pas de temps DB gaspillé).
  // Un import complet = 12 feuilles + plusieurs milliers de montants ; on garde la
  // transaction la plus courte possible et on l'alimente avec des lots prêts.
  const sheetRows = parsed.sheets.map((sheet, sheetIndex) => ({
    name: sheet.name,
    category: sheet.category,
    rowCount: sheet.rowCount,
    colCount: sheet.colCount,
    sheetIndex,
    cellData: JSON.stringify(sheet.cellData),
    searchText: sheet.searchText.toLowerCase(),
  }))

  // La trace complète (cellule, valeur brute, mapping, statut) est rangée dans
  // rawData — exposée dans la preview admin, jamais dans les CSV publics.
  const amountRows = validatedAmounts.map((a) => ({
    sourceSheet: a.sourceSheet,
    category: a.category,
    allocationCode: a.allocationCode ?? null,
    salaryCode: a.salaryCode ?? null,
    article: a.article ?? null,
    labelFr: a.labelFr ?? null,
    labelNl: a.labelNl ?? null,
    unit: a.unit ?? null,
    amount: new Prisma.Decimal(a.amount),
    minDailySalary: a.minDailySalary != null ? new Prisma.Decimal(a.minDailySalary) : null,
    maxDailySalary: a.maxDailySalary != null ? new Prisma.Decimal(a.maxDailySalary) : null,
    validFrom: a.validFrom ?? null,
    rawData: {
      ...(a.rawData ?? {}),
      trace: a.trace ?? null,
      status: a.status ?? 'valid',
      warnings: a.warnings ?? [],
    } as unknown as Prisma.InputJsonValue,
    comparisonKey: a.comparisonKey,
  }))

  // Lots de 500 : ~13 colonnes × 500 = 6500 paramètres, bien sous la limite
  // Postgres (~65535). Évite l'erreur "too many bind parameters" sur les gros imports.
  const AMOUNT_CHUNK = 500

  // 6) Insertion DB (transaction atomique, timeout élargi pour la DB Neon distante).
  const fileId = await withDbRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const created = await tx.baremeFile.create({
          data: {
            name: input.fileName,
            filePath: storedPath ?? '',
            fileHash,
            fileSize,
            effectiveDate: parsed.fileMetadata.effectiveDate,
            validFrom: normalized.validFrom,
            multiplicateur: parsed.fileMetadata.multiplicateur,
            status: 'draft',
            summary: normalized.summary as unknown as Prisma.InputJsonValue,
            diagnostics: diagnostics as unknown as Prisma.InputJsonValue,
            alerts: normalized.alerts as unknown as Prisma.InputJsonValue,
            requiresApproval: input.requiresApproval ?? false,
            createdBy: input.createdBy ?? null,
          },
          select: { id: true },
        })

        // Grilles brutes (viewer/diagnostic) : un seul createMany au lieu de 12 inserts.
        await tx.bareSheet.createMany({
          data: sheetRows.map((s) => ({ ...s, fileId: created.id })),
        })

        // Montants normalisés (source des calculateurs) par lots.
        for (let i = 0; i < amountRows.length; i += AMOUNT_CHUNK) {
          const chunk = amountRows.slice(i, i + AMOUNT_CHUNK)
          await tx.baremeAmount.createMany({
            data: chunk.map((a) => ({ ...a, fileId: created.id })),
          })
        }

        return created.id
      },
      { timeout: 30_000, maxWait: 10_000 }
    )
  )

  const errorCount = normalized.alerts.filter(isBlockingIssue).length
  const warningCount = normalized.alerts.filter(
    (a) => !isBlockingIssue(a) && a.level === 'warn'
  ).length

  // Audit : trace la création du draft (log d'import complet)
  await logPublicationEvent({
    fileId,
    action: 'created',
    toStatus: 'draft',
    actorEmail: input.createdBy,
    details: {
      fileName: input.fileName,
      fileSize,
      fileHash,
      validFrom: normalized.validFrom?.toISOString() ?? null,
      sheetsDetected: normalized.summary.sheetsDetected,
      sheetsParsed: normalized.summary.sheetsParsed,
      amountsExtracted: normalized.summary.amountsExtracted,
      errorCount,
      warningCount,
      unknownCodesCount: diagnostics.unknownCodes.length,
      ignoredRowsCount: diagnostics.ignoredRows.length,
      roundTripChecked: roundTrip.checked,
      roundTripMismatches: roundTrip.mismatches,
      mappingOverridesUsed: Object.keys(overrides).length,
      importStatus: errorCount > 0 ? 'success_with_errors' : warningCount > 0 ? 'success_with_warnings' : 'success',
    },
  })

  // Post-import : comparaison avec dernier published + détection d'anomalies
  // Si ça échoue (ex: pas de version précédente), on log mais on n'invalide pas l'import.
  let enrichedSummary = normalized.summary
  let enrichedAlerts = normalized.alerts
  try {
    const diff = await compareBaremeVersions(fileId)
    const anomalies = detectAnomaliesFromDiff(diff)
    enrichedAlerts = [...anomalies, ...normalized.alerts]
    enrichedSummary = {
      ...normalized.summary,
      newEntries: diff.countsByType.new_entry,
      modifiedEntries: diff.countsByType.amount_changed,
      removedEntries: diff.countsByType.removed_entry,
    }

    // Mettre à jour la fiche avec les enrichissements
    await withDbRetry(() =>
      prisma.baremeFile.update({
        where: { id: fileId },
        data: {
          summary: enrichedSummary as unknown as Prisma.InputJsonValue,
          alerts: enrichedAlerts as unknown as Prisma.InputJsonValue,
        },
      })
    )
  } catch (err) {
    // Ne pas casser l'import si la comparaison échoue
    console.warn('[importBaremeFile] compareBaremeVersions failed:', err)
  }

  return {
    status: 'created',
    fileId,
    summary: enrichedSummary,
    alerts: enrichedAlerts,
    validFrom: normalized.validFrom,
    exportAllowed: !enrichedAlerts.some(isBlockingIssue),
  }
}

function sanitizeFileName(name: string): string {
  // Garde une extension .xlsx, remplace les caractères suspects par _
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200)
}
