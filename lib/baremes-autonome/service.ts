import { createHash } from 'node:crypto'
import { Prisma, type AutonomousRateVersion } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  CURRENT_PARSER_VERSION,
  isSupportedReaderVersion,
  readWorkbook,
  readWorkbookVersion,
} from './read-workbook'
import { comparableUnit, compareReadings, digest, snapshotDigest } from './compare'
import type { Reading, Snapshot, VersionRef, Workspace, ChangeKind } from './types'
import type { DecisionView, ReviewDetails, ReviewState } from './review-types'
import { analyzeReview, reviewTechnicalIssues, taskRows, variation } from './review-policy'

const registryId = 'autonomous-rates'
export class RateError extends Error {
  constructor(
    public code: string,
    public status = 422,
  ) {
    super(code)
  }
}
const readingOf = (version: AutonomousRateVersion) => version.reading as unknown as Reading
const json = (value: unknown) => value as Prisma.InputJsonValue
const hashFile = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const revisionOf = (fileHash: string, reading: Reading) => digest({ fileHash, reading })
function ref(version: AutonomousRateVersion): VersionRef {
  return {
    id: version.id,
    name: version.name,
    revision: version.revision,
    effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null,
    count: readingOf(version).values.length,
  }
}

// Central-directory limits are checked before xlsx expands the archive.
export function validateArchive(buffer: Buffer): void {
  if (buffer.length > 5 * 1024 * 1024 || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50)
    throw new RateError('INVALID_FILE')
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new RateError('INVALID_FILE')
  const entries = buffer.readUInt16LE(end + 10)
  let cursor = buffer.readUInt32LE(end + 16),
    expanded = 0
  if (entries > 2000 || cursor > end) throw new RateError('INVALID_FILE')
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new RateError('INVALID_FILE')
    expanded += buffer.readUInt32LE(cursor + 24)
    if (expanded > 30 * 1024 * 1024) throw new RateError('INVALID_FILE')
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32)
  }
}

export async function importVersion(bytes: Buffer, name: string, actorId: string) {
  validateArchive(bytes)
  let reading: Reading
  try {
    reading = readWorkbook(bytes)
  } catch {
    throw new RateError('INVALID_WORKBOOK')
  }
  if (reading.values.length > 30000 || reading.values.length === 0) throw new RateError('EMPTY_READING')
  const fileHash = hashFile(bytes)
  const version = await prisma.autonomousRateVersion.create({
    data: {
      name: name.replace(/[\r\n\x00-\x1f]/g, '').slice(0, 180),
      original: bytes,
      fileHash,
      revision: revisionOf(fileHash, reading),
      reading: json(reading),
      createdBy: actorId,
      effectiveFrom: reading.effectiveFrom ? new Date(reading.effectiveFrom) : null,
    },
    select: { id: true },
  })
  return version
}

export async function listVersions() {
  // Do not fetch original bytes in the history list.
  const [versions, registry] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string
        name: string
        revision: string
        effectiveFrom: Date | null
        createdAt: Date
        publishedAt: Date | null
        count: number
      }>
    >`
      SELECT "id", "name", "revision", "effectiveFrom", "createdAt", "publishedAt", jsonb_array_length("reading"->'values') AS count
      FROM "AutonomousRateVersion" ORDER BY "createdAt" DESC, "id" DESC LIMIT 100`,
    prisma.autonomousRateRegistry.findUnique({ where: { id: registryId } }),
  ])
  return { versions, publishedId: registry?.versionId ?? null }
}

export type Filters = {
  page: number
  q?: string
  sheet?: string
  kind?: ChangeKind
  includeUnchanged?: boolean
}
type PublicationRecord = { comparison: Snapshot; review: ReviewState; issues: Reading['issues'] }
function publishedSnapshot(value: unknown): Snapshot {
  const record = value as Partial<PublicationRecord>
  return record.comparison ?? (value as Snapshot)
}
function compose(
  candidate: AutonomousRateVersion,
  reference: AutonomousRateVersion | null,
  generation: number,
  filters: Filters,
  decisions: DecisionView[],
  differences: import('./types').Difference[],
): Workspace {
  const after = readingOf(candidate),
    before = reference ? readingOf(reference) : null
  const issues = [...after.issues]
  if (after.parserVersion !== CURRENT_PARSER_VERSION)
    issues.push({ code: 'PARSER_VERSION_OUTDATED', sheet: '', blocking: true })
  if (
    before &&
    (!isSupportedReaderVersion(before.parserVersion) ||
      (before.identityVersion ?? 1) !== (after.identityVersion ?? 1))
  )
    issues.push({ code: 'INCOMPATIBLE_READING', sheet: '', blocking: true })
  if ((candidate.effectiveFrom?.toISOString().slice(0, 10) ?? null) !== after.effectiveFrom)
    issues.push({ code: 'INVALID_EFFECTIVE_DATE', sheet: '', blocking: true })
  if (
    before &&
    before.sheets.some(
      (sheet) =>
        !after.sheets.includes(sheet) &&
        !after.scope?.some((scope) => scope.sheet === sheet && scope.state === 'absent'),
    )
  )
    issues.push({ code: 'COVERAGE_LOSS', sheet: '', blocking: true })
  issues.push(...reviewTechnicalIssues(differences, after))
  const counts = { modified: 0, added: 0, absent: 0, unchanged: 0 }
  for (const row of differences) counts[row.kind]++
  const token = {
    candidateId: candidate.id,
    candidateRevision: candidate.revision,
    referenceId: reference?.id ?? null,
    referenceRevision: reference?.revision ?? null,
    generation,
  }
  const review = analyzeReview(
    before,
    after,
    differences,
    token,
    decisions,
    issues.some((issue) => issue.blocking),
    !!candidate.publishedAt,
  )
  const query = filters.q?.toLowerCase() ?? ''
  const filtered = differences.filter((row) => {
    const value = row.after ?? row.before!
    return (
      (filters.kind
        ? row.kind === filters.kind
        : filters.includeUnchanged || !before || row.kind !== 'unchanged') &&
      (!filters.sheet || value.source.sheet === filters.sheet) &&
      (!query || [value.code, value.label, ...value.context].join(' ').toLowerCase().includes(query))
    )
  })
  return {
    candidate: ref(candidate),
    reference: reference ? ref(reference) : null,
    snapshot: { ...token, digest: snapshotDigest(token), analysis: review.fingerprint },
    counts,
    issues,
    review,
    sheets: [...new Set(differences.map((r) => (r.after ?? r.before!).source.sheet))],
    items: filtered.slice((filters.page - 1) * 50, filters.page * 50),
    total: filtered.length,
    page: filters.page,
    canPublish: review.availability === 'ready',
    coverage: after.coverage,
  }
}

export async function loadComparison(
  tx: Prisma.TransactionClient,
  id: string,
  filters: Filters = { page: 1 },
) {
  const candidate = await tx.autonomousRateVersion.findUnique({ where: { id } })
  if (!candidate) throw new RateError('NOT_FOUND', 404)
  const registry = await tx.autonomousRateRegistry.findUnique({ where: { id: registryId } })
  const publication = candidate.publishedAt
    ? await tx.autonomousRatePublication.findUnique({ where: { versionId: id } })
    : null
  const recorded = publication ? publishedSnapshot(publication.snapshot) : undefined
  const frozen = publication?.snapshot as unknown as Partial<PublicationRecord> | undefined
  const referenceId = publication ? publication.previousId : registry?.versionId
  const reference = referenceId
    ? await tx.autonomousRateVersion.findUnique({ where: { id: referenceId } })
    : null
  if (referenceId && !reference) throw new RateError('REFERENCE_UNAVAILABLE', 409)
  const stored = await tx.autonomousRateDecision.findMany({
    where: { candidateId: id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 30000,
    select: {
      id: true,
      taskId: true,
      kind: true,
      status: true,
      reason: true,
      actorId: true,
      createdAt: true,
      officialSource: true,
      regulatoryScope: true,
      effectiveDate: true,
      fingerprint: true,
    },
  })
  const decisions: DecisionView[] = stored.map((decision) => ({
    ...decision,
    createdAt: decision.createdAt.toISOString(),
    effectiveDate: decision.effectiveDate?.toISOString().slice(0, 10) ?? null,
  }))
  const rows = compareReadings(reference ? readingOf(reference) : null, readingOf(candidate))
  const workspace = compose(
    candidate,
    reference,
    recorded?.generation ?? registry?.generation ?? 0,
    filters,
    decisions,
    rows,
  )
  if (publication && recorded?.candidateId === id) {
    workspace.snapshot = recorded
    if (frozen?.review) {
      workspace.review = { ...frozen.review, availability: 'published' }
      workspace.issues = frozen.issues ?? workspace.issues
    } else
      workspace.review = {
        ...workspace.review!,
        tasks: [],
        pending: 0,
        accepted: 0,
        affectedRows: 0,
        availability: 'published',
      }
  }
  return { candidate, reference, workspace, decisions, rows }
}

export function assertIntegrity(candidate: AutonomousRateVersion, reference: AutonomousRateVersion | null) {
  for (const version of [candidate, reference])
    if (version) {
      const fileHash = hashFile(Buffer.from(version.original)),
        reading = readingOf(version)
      if (
        fileHash !== version.fileHash ||
        revisionOf(fileHash, reading) !== version.revision ||
        (version.effectiveFrom?.toISOString().slice(0, 10) ?? null) !== reading.effectiveFrom ||
        digest(readWorkbookVersion(Buffer.from(version.original), reading.parserVersion)) !==
          digest(version.reading)
      )
        throw new RateError('REVISION_CHANGED', 409)
    }
}

export async function withRateMutation<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(728640241)::text AS locked`
        return callback(tx)
      },
      { isolationLevel: 'Serializable', timeout: 30000 },
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code))
      throw new RateError('STALE_COMPARISON', 409)
    throw error
  }
}

export async function getWorkspace(id: string, filters: Filters): Promise<Workspace> {
  // Repeatable snapshot: registry and reference cannot come from different publications.
  return prisma.$transaction(
    async (tx) => {
      return (await loadComparison(tx, id, filters)).workspace
    },
    { isolationLevel: 'RepeatableRead' },
  )
}

export async function publishVersion(id: string, expected: Snapshot, actorId: string) {
  return withRateMutation(async (tx) => {
    const existing = await tx.autonomousRatePublication.findUnique({ where: { versionId: id } })
    if (existing) {
      if (digest(publishedSnapshot(existing.snapshot)) !== digest(expected))
        throw new RateError('STALE_COMPARISON', 409)
      return { id, published: true }
    }
    const registry = await tx.autonomousRateRegistry.findUnique({ where: { id: registryId } })
    if (!registry) throw new RateError('REFERENCE_UNAVAILABLE', 409)
    const { candidate, reference, workspace: current } = await loadComparison(tx, id)
    if (digest(current.snapshot) !== digest(expected)) throw new RateError('STALE_COMPARISON', 409)
    if (!current.canPublish) throw new RateError('BLOCKED')
    assertIntegrity(candidate, reference)
    await tx.autonomousRatePublication.create({
      data: {
        versionId: id,
        previousId: registry.versionId,
        actorId,
        snapshot: json({ comparison: expected, review: current.review, issues: current.issues }),
      },
    })
    await tx.autonomousRateVersion.update({ where: { id }, data: { publishedAt: new Date() } })
    await tx.autonomousRateRegistry.update({
      where: { id: registryId },
      data: { versionId: id, generation: { increment: 1 } },
    })
    return { id, published: true }
  })
}

export async function getReviewDetails(id: string, taskId: string): Promise<ReviewDetails> {
  return prisma.$transaction(
    async (tx) => {
      const { workspace, candidate, rows } = await loadComparison(tx, id)
      const task = workspace.review!.tasks.find((item) => item.id === taskId)
      if (!task) throw new RateError('STALE_COMPARISON', 409)
      const members = taskRows(task, rows),
        reading = readingOf(candidate)
      const evidence = reading.scope?.find((item) => item.sheet === task.sheet)
      if (!evidence) throw new RateError('BLOCKED')
      const deltas: ReviewDetails['deltas'] = {}
      for (const row of members)
        if (
          row.before &&
          row.after &&
          !row.before.valueKind &&
          !row.after.valueKind &&
          comparableUnit(row.before) === comparableUnit(row.after)
        )
          deltas[row.key] = variation(row.before.value, row.after.value)
      return {
        task,
        fingerprint: workspace.review!.fingerprint,
        snapshot: workspace.snapshot,
        members,
        evidence,
        deltas,
      }
    },
    { isolationLevel: 'RepeatableRead' },
  )
}

export async function getComparisonReport(id: string) {
  return prisma.$transaction(
    async (tx) => {
      const { candidate, reference, workspace, rows, decisions } = await loadComparison(tx, id, {
        page: 1,
        includeUnchanged: true,
      })
      return {
        candidate: workspace.candidate,
        reference: workspace.reference,
        fileHash: candidate.fileHash,
        referenceFileHash: reference?.fileHash ?? null,
        snapshot: workspace.snapshot,
        review: workspace.review,
        issues: workspace.issues,
        coverage: workspace.coverage,
        rows,
        decisions: decisions.map((decision) => ({
          ...decision,
          stale: decision.fingerprint !== workspace.review!.fingerprint,
        })),
      }
    },
    { isolationLevel: 'RepeatableRead' },
  )
}

export async function getSource(id: string) {
  const version = await prisma.autonomousRateVersion.findUnique({
    where: { id },
    select: { name: true, original: true, fileHash: true },
  })
  if (!version) throw new RateError('NOT_FOUND', 404)
  if (hashFile(Buffer.from(version.original)) !== version.fileHash)
    throw new RateError('REVISION_CHANGED', 409)
  return version
}
