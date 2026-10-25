import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma, withDbRetry } from '@/lib/prisma'
import {
  hashLookupValue,
  LOOKUP_IMPORT_PARSER_VERSION,
  prepareLookupCsv,
  type LookupEntrySnapshot,
  type LookupImportDiff,
} from './importLookupCsv'

const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const WRITE_CHUNK = 400
const TRANSFORMATION = { columns: 'auto-detect-v1', duplicatePolicy: 'reject-conflicting' } as const

const preparedEntrySchema = z.object({
  code: z.string().min(1),
  labelFr: z.string(),
  labelNl: z.string(),
  labelDe: z.string().nullable(),
  labelEn: z.string().nullable(),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
  existingId: z.string().nullable(),
})

export interface CreateLookupImportProposalInput {
  tableId: string
  csvContent: string
  fileName?: string
  createdBy: string
}

export interface LookupImportProposalResult {
  id: string
  state: string
  requiresApproval: boolean
  sourceSha256: string
  baseRevision: number
  parserVersion: string
  diff: LookupImportDiff
  errors?: { row: number; message: string }[]
  totalRows: number
}

export interface PublishLookupImportResult {
  state: 'published' | 'stale' | 'pending_approvals' | 'already_published'
  inserted?: number
  updated?: number
  unchanged?: number
  errors: { row: number; message: string }[]
  totalRows: number
  diff: LookupImportDiff
  approvalsCount?: number
  requiredApprovals?: number
  publishedRevision?: number
}

interface LookupTableSnapshot {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  sourcePath: string | null
  exportName: string | null
  updatedAt: Date
  publishedRevision: number
  requiresApproval: boolean
}

const snapshotTableSelect = {
  id: true,
  slug: true,
  prefix: true,
  labelFr: true,
  labelNl: true,
  sourcePath: true,
  exportName: true,
  updatedAt: true,
  publishedRevision: true,
  requiresApproval: true,
} as const

async function loadEntries(
  client: Pick<Prisma.TransactionClient, 'lookupEntry'>,
  tableId: string,
): Promise<LookupEntrySnapshot[]> {
  const entries: LookupEntrySnapshot[] = []
  let cursor: string | undefined
  while (true) {
    const chunk = await client.lookupEntry.findMany({
      where: { tableId },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, code: true, validFrom: true, validUntil: true,
        labelFr: true, labelNl: true, labelDe: true, labelEn: true, metadata: true,
      },
    })
    if (chunk.length === 0) break
    entries.push(...chunk)
    cursor = chunk[chunk.length - 1].id
    if (chunk.length < 1000) break
  }
  return entries
}

function baseHash(table: LookupTableSnapshot, entries: LookupEntrySnapshot[]): string {
  return hashLookupValue({
    table: {
      id: table.id,
      slug: table.slug,
      prefix: table.prefix,
      labelFr: table.labelFr,
      labelNl: table.labelNl,
      sourcePath: table.sourcePath,
      exportName: table.exportName,
      updatedAt: table.updatedAt,
      publishedRevision: table.publishedRevision,
      requiresApproval: table.requiresApproval,
    },
    entries,
  })
}

export async function createLookupImportProposal(
  input: CreateLookupImportProposalInput,
): Promise<LookupImportProposalResult> {
  if (Buffer.byteLength(input.csvContent, 'utf8') > MAX_SOURCE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_SOURCE_BYTES / 1024 / 1024} MB)`)
  }
  const table = await withDbRetry(() => prisma.lookupTable.findUnique({
    where: { id: input.tableId },
    select: snapshotTableSelect,
  }))
  if (!table) throw new Error('Table de lookup introuvable')

  const entries = await withDbRetry(() => loadEntries(prisma, input.tableId))
  const sourceSha256 = createHash('sha256').update(input.csvContent).digest('hex')
  const referenceHash = baseHash(table, entries)
  let prepared: Awaited<ReturnType<typeof prepareLookupCsv>> | null = null
  let parseError: string | null = null
  try {
    prepared = await prepareLookupCsv(input.tableId, input.csvContent, entries)
    if (prepared.errors.length > 0) parseError = `${prepared.errors.length} erreur(s) de validation détectée(s)`
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error)
  }

  const state = parseError ? 'failed' : 'prepared'
  const normalizedPayload = prepared && !parseError
    ? prepared.entries as unknown as Prisma.InputJsonValue
    : Prisma.DbNull
  const diff = prepared?.diff ?? { added: [], modified: [], absentFromExport: [] }
  const payloadHash = prepared && !parseError ? hashLookupValue(prepared.entries) : null
  const created = await prisma.lookupImportProposal.create({
    data: {
      tableId: input.tableId,
      sourceFileName: sanitizeFileName(input.fileName),
      sourceContent: input.csvContent,
      sourceSha256,
      payloadHash,
      baseRevision: table.publishedRevision,
      baseHash: referenceHash,
      parserVersion: LOOKUP_IMPORT_PARSER_VERSION,
      transformation: TRANSFORMATION,
      normalizedPayload,
      diff: diff as unknown as Prisma.InputJsonValue,
      validationErrors: prepared?.errors.length
        ? prepared.errors as unknown as Prisma.InputJsonValue
        : parseError ? [{ row: 0, message: parseError }] as unknown as Prisma.InputJsonValue : Prisma.DbNull,
      state,
      errorMessage: parseError,
      totalRows: prepared?.totalRows ?? 0,
      createdBy: input.createdBy,
    },
    select: {
      id: true, state: true, sourceSha256: true, baseRevision: true,
      parserVersion: true, diff: true, validationErrors: true, totalRows: true,
    },
  }).catch(async (error: unknown) => {
    if (!isUniqueConstraintError(error)) throw error
    const existing = await prisma.lookupImportProposal.findUnique({
      where: {
        tableId_sourceSha256_baseHash_parserVersion: {
          tableId: input.tableId,
          sourceSha256,
          baseHash: referenceHash,
          parserVersion: LOOKUP_IMPORT_PARSER_VERSION,
        },
      },
      select: {
        id: true, state: true, sourceSha256: true, baseRevision: true,
        parserVersion: true, diff: true, validationErrors: true, totalRows: true,
      },
    })
    if (!existing) throw error
    return existing
  })

  const payload = prepared && !parseError ? prepared : null
  const diffValue = created.diff as unknown as LookupImportDiff
  return {
    id: created.id,
    state: created.state,
    requiresApproval: table.requiresApproval,
    sourceSha256: created.sourceSha256,
    baseRevision: created.baseRevision,
    parserVersion: created.parserVersion,
    diff: diffValue,
    errors: created.state === 'failed'
      ? (payload?.errors ?? (Array.isArray(created.validationErrors)
          ? created.validationErrors as unknown as { row: number; message: string }[]
          : [{ row: 0, message: parseError ?? 'Validation failed' }]))
      : undefined,
    totalRows: created.totalRows,
  }
}

export async function publishLookupImportProposal(input: {
  proposalId: string
  publishedBy: string
  expectedTableId?: string
  retryFailed?: boolean
}): Promise<PublishLookupImportResult> {
  try {
    return await withSerializationRetry(() => prisma.$transaction(async (tx) => {
      const proposalIdentity = await tx.lookupImportProposal.findUnique({
        where: { id: input.proposalId },
        select: { id: true, tableId: true },
      })
      if (!proposalIdentity) throw new Error('Proposition d’import introuvable')
      if (input.expectedTableId && proposalIdentity.tableId !== input.expectedTableId) {
        throw new Error('La proposition ne correspond pas à cette table')
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "LookupTable" WHERE "id" = ${proposalIdentity.tableId} FOR UPDATE`)
      const table = await tx.lookupTable.findUnique({
        where: { id: proposalIdentity.tableId },
        select: snapshotTableSelect,
      })
      const proposal = await tx.lookupImportProposal.findUnique({
        where: { id: input.proposalId },
        include: { approvals: { select: { approverEmail: true }, take: 10 } },
      })
      if (!table || !proposal) throw new Error('Proposition d’import introuvable')
      const diff = proposal.diff as unknown as LookupImportDiff
      if (proposal.state === 'published') {
        return { state: 'already_published', errors: [], totalRows: 0, diff, publishedRevision: table.publishedRevision }
      }
      const retryingFailure = proposal.state === 'failed' && input.retryFailed === true
      if (proposal.state !== 'prepared' && !retryingFailure) {
        throw new Error(`Proposition non publiable (état ${proposal.state})`)
      }
      if (retryingFailure && (!proposal.payloadHash || proposal.normalizedPayload == null)) {
        throw new Error('Cette proposition échouée ne contient pas de comparatif réessayable.')
      }
      if (proposal.parserVersion !== LOOKUP_IMPORT_PARSER_VERSION ||
          hashLookupValue(proposal.transformation) !== hashLookupValue(TRANSFORMATION) ||
          createHash('sha256').update(proposal.sourceContent).digest('hex') !== proposal.sourceSha256) {
        await tx.lookupImportProposal.update({
          where: { id: proposal.id },
          data: { state: 'stale', errorMessage: 'Fichier, parseur ou transformation différent de la proposition.' },
        })
        return { state: 'stale', errors: [], totalRows: 0, diff }
      }

      const currentEntries = await loadEntries(tx, table.id)
      const currentHash = baseHash(table, currentEntries)
      if (table.publishedRevision !== proposal.baseRevision || currentHash !== proposal.baseHash) {
        await tx.lookupImportProposal.update({
          where: { id: proposal.id },
          data: { state: 'stale', errorMessage: 'La référence publiée a changé depuis la comparaison.' },
        })
        return { state: 'stale', errors: [], totalRows: 0, diff }
      }

      const approvalsCount = new Set(proposal.approvals.map((approval) => approval.approverEmail)).size
      if (table.requiresApproval && approvalsCount < 2) {
        if (retryingFailure) {
          await tx.lookupImportProposal.update({
            where: { id: proposal.id },
            data: { state: 'prepared' },
          })
        }
        return {
          state: 'pending_approvals', errors: [], totalRows: 0, diff,
          approvalsCount, requiredApprovals: 2,
        }
      }

      const entries = preparedEntrySchema.array().parse(proposal.normalizedPayload)
      if (hashLookupValue(entries) !== proposal.payloadHash) throw new Error('Empreinte du contenu préparé invalide')
      const inserts = entries.filter((entry) => entry.existingId === null)
      const updates = entries.filter((entry) => entry.existingId !== null)
      if (inserts.length === 0 && updates.length === 0) {
        await tx.lookupImportProposal.update({
          where: { id: proposal.id },
          data: { state: 'published', publishedAt: new Date(), errorMessage: null },
        })
        return {
          state: 'published', inserted: 0, updated: 0, unchanged: entries.length,
          errors: [], totalRows: entries.length, diff, publishedRevision: table.publishedRevision,
        }
      }
      for (let start = 0; start < inserts.length; start += WRITE_CHUNK) {
        const chunk = inserts.slice(start, start + WRITE_CHUNK)
        await tx.lookupEntry.createMany({
          data: chunk.map((entry) => ({
            tableId: table.id,
            code: entry.code,
            labelFr: entry.labelFr,
            labelNl: entry.labelNl,
            labelDe: entry.labelDe,
            labelEn: entry.labelEn,
            validFrom: entry.validFrom ? new Date(entry.validFrom) : null,
            validUntil: entry.validUntil ? new Date(entry.validUntil) : null,
            metadata: entry.metadata ?? Prisma.DbNull,
          })),
        })
      }
      for (let start = 0; start < updates.length; start += WRITE_CHUNK) {
        const chunk = updates.slice(start, start + WRITE_CHUNK)
        const values = chunk.map((entry) => Prisma.sql`(
          ${entry.existingId}, ${entry.labelFr}, ${entry.labelNl}, ${entry.labelDe}, ${entry.labelEn},
          ${entry.validUntil ? new Date(entry.validUntil) : null},
          ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb
        )`)
        const count = await tx.$executeRaw(Prisma.sql`
          UPDATE "LookupEntry" AS e
          SET "labelFr" = v."labelFr", "labelNl" = v."labelNl", "labelDe" = v."labelDe",
              "labelEn" = v."labelEn", "validUntil" = v."validUntil", "metadata" = v."metadata",
              "updatedAt" = NOW()
          FROM (VALUES ${Prisma.join(values)}) AS v("id", "labelFr", "labelNl", "labelDe", "labelEn", "validUntil", "metadata")
          WHERE e."id" = v."id" AND e."tableId" = ${table.id}
        `)
        if (count !== chunk.length) throw new Error('Le nombre de lignes modifiées ne correspond pas au comparatif')
      }

      const entriesCount = await tx.lookupEntry.count({ where: { tableId: table.id } })
      const publishedTable = await tx.lookupTable.update({
        where: { id: table.id },
        data: {
          entriesCount,
          lastImportedAt: new Date(),
          lastImportedBy: input.publishedBy,
          lastImportSource: proposal.sourceFileName,
          publishedRevision: { increment: 1 },
        },
        select: { slug: true, publishedRevision: true },
      })
      await tx.lookupImportProposal.update({
        where: { id: proposal.id },
        data: { state: 'published', publishedAt: new Date(), errorMessage: null },
      })
      return {
        state: 'published',
        inserted: inserts.length,
        updated: updates.length,
        unchanged: entries.length - inserts.length - updates.length,
        errors: [],
        totalRows: entries.length,
        diff,
        publishedRevision: publishedTable.publishedRevision,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 }))
  } catch (error) {
    await prisma.lookupImportProposal.updateMany({
      where: {
        id: input.proposalId,
        state: input.retryFailed ? { in: ['prepared', 'failed'] } : 'prepared',
      },
      data: { state: 'failed', errorMessage: safeErrorMessage(error) },
    }).catch(() => undefined)
    throw error
  }
}

async function withSerializationRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = 4
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isSerializationConflict(error) || attempt === maxAttempts - 1) throw error
      await new Promise((resolve) => setTimeout(resolve, 25 * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

function isSerializationConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const sqlState = typeof error.meta?.code === 'string' ? error.meta.code : ''
    return error.code === 'P2034' || sqlState === '40001'
  }
  return error instanceof Error && /could not serialize access|serialization failure|40001/i.test(error.message)
}

function sanitizeFileName(fileName?: string): string {
  const cleaned = (fileName ?? 'lookup-import.csv').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200)
  return cleaned || 'lookup-import.csv'
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 1000) : 'Erreur inconnue lors de la publication.'
}
