import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { Prisma } from '@prisma/client'
import { prisma, withDbRetry } from '@/lib/prisma'
import { parseBaremaFile } from '@/lib/baremes-parser'
import { sha256 } from './hash'
import { normalizeBaremeData } from './normalizeBaremeData'
import { extractValidFromFileName } from './normalize'
import { compareBaremeVersions, detectAnomaliesFromDiff } from './compareBaremeVersions'
import { loadSheetMappingOverrides } from './loadSheetMappings'
import { logPublicationEvent } from './publicationLog'
import type { BaremeAlert, BaremeImportSummary } from './types'

const UPLOAD_SUBDIR = 'public/uploads/baremes'

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
    }
  | {
      status: 'duplicate'
      fileId: string
      message: string
    }

/**
 * Pipeline complet d'import d'un fichier .xlsx de barèmes.
 *
 *  1. Calcule sha256 du fichier
 *  2. Vérifie l'absence d'un BaremeFile avec le même hash (dedup)
 *  3. Sauvegarde le fichier sur disque
 *  4. Lit le workbook (parseBaremaFile existant)
 *  5. Dispatche vers les parsers dédiés (normalizeBaremeData)
 *  6. Insère BaremeFile (status="draft") + BaremeAmount[] en transaction
 *  7. Crée aussi les BareSheet (vue grille brute) pour cohérence avec le viewer
 */
export async function importBaremeFile(
  input: ImportBaremeInput
): Promise<ImportBaremeResult> {
  if (!input.fileName.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Seuls les fichiers .xlsx sont acceptés')
  }

  const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer)
  const fileHash = sha256(buffer)

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

  // 4) Sauvegarde disque
  const uploadDir = path.join(/* turbopackIgnore: true */ process.cwd(), UPLOAD_SUBDIR)
  await mkdir(uploadDir, { recursive: true })
  const safeName = sanitizeFileName(input.fileName)
  const storedName = `${Date.now()}-${safeName}`
  const fullPath = path.join(uploadDir, storedName)
  await writeFile(fullPath, buffer)

  // 5) Insertion DB (transaction)
  const fileId = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const created = await tx.baremeFile.create({
        data: {
          name: input.fileName,
          filePath: `/uploads/baremes/${storedName}`,
          fileHash,
          effectiveDate: parsed.fileMetadata.effectiveDate,
          validFrom: normalized.validFrom,
          multiplicateur: parsed.fileMetadata.multiplicateur,
          status: 'draft',
          summary: normalized.summary as unknown as Prisma.InputJsonValue,
          alerts: normalized.alerts as unknown as Prisma.InputJsonValue,
          requiresApproval: input.requiresApproval ?? false,
          createdBy: input.createdBy ?? null,
        },
        select: { id: true },
      })

      // BareSheet : on conserve la vue grille brute pour le viewer existant
      let sheetIndex = 0
      for (const sheet of parsed.sheets) {
        await tx.bareSheet.create({
          data: {
            fileId: created.id,
            name: sheet.name,
            category: sheet.category,
            rowCount: sheet.rowCount,
            colCount: sheet.colCount,
            sheetIndex,
            cellData: JSON.stringify(sheet.cellData),
            searchText: sheet.searchText.toLowerCase(),
          },
        })
        sheetIndex++
      }

      // BaremeAmount : couche normalisée (la "vraie" source des calculateurs)
      if (normalized.amounts.length > 0) {
        await tx.baremeAmount.createMany({
          data: normalized.amounts.map((a) => ({
            fileId: created.id,
            sourceSheet: a.sourceSheet,
            category: a.category,
            allocationCode: a.allocationCode ?? null,
            salaryCode: a.salaryCode ?? null,
            article: a.article ?? null,
            labelFr: a.labelFr ?? null,
            labelNl: a.labelNl ?? null,
            unit: a.unit ?? null,
            amount: new Prisma.Decimal(a.amount),
            minDailySalary:
              a.minDailySalary != null ? new Prisma.Decimal(a.minDailySalary) : null,
            maxDailySalary:
              a.maxDailySalary != null ? new Prisma.Decimal(a.maxDailySalary) : null,
            validFrom: a.validFrom ?? null,
            rawData: a.rawData
              ? (a.rawData as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            comparisonKey: a.comparisonKey,
          })),
        })
      }

      return created.id
    })
  )

  // Audit : trace la création du draft
  await logPublicationEvent({
    fileId,
    action: 'created',
    toStatus: 'draft',
    actorEmail: input.createdBy,
    details: {
      sheetsParsed: normalized.summary.sheetsParsed,
      amountsExtracted: normalized.summary.amountsExtracted,
      mappingOverridesUsed: Object.keys(overrides).length,
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
  }
}

function sanitizeFileName(name: string): string {
  // Garde une extension .xlsx, remplace les caractères suspects par _
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-200)
}
