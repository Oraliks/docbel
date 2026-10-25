import { createHash } from 'node:crypto'
import { Prisma, type AutonomousRateVersion } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CURRENT_PARSER_VERSION, isSupportedReaderVersion, readWorkbook, readWorkbookVersion } from './read-workbook'
import { compareReadings, digest, snapshotDigest } from './compare'
import type { Reading, Snapshot, VersionRef, Workspace, ChangeKind } from './types'

const registryId = 'autonomous-rates'
export class RateError extends Error {
  constructor(public code: string, public status = 422) { super(code) }
}
const readingOf = (version: AutonomousRateVersion) => version.reading as unknown as Reading
const json = (value: unknown) => value as Prisma.InputJsonValue
const hashFile = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const revisionOf = (fileHash: string, reading: Reading) => digest({ fileHash, reading })
function ref(version: AutonomousRateVersion): VersionRef {
  return { id: version.id, name: version.name, revision: version.revision,
    effectiveFrom: version.effectiveFrom?.toISOString() ?? null, createdAt: version.createdAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() ?? null, count: readingOf(version).values.length }
}

// Central-directory limits are checked before xlsx expands the archive.
export function validateArchive(buffer: Buffer): void {
  if (buffer.length > 5 * 1024 * 1024 || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new RateError('INVALID_FILE')
  let end = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) throw new RateError('INVALID_FILE')
  const entries = buffer.readUInt16LE(end + 10)
  let cursor = buffer.readUInt32LE(end + 16), expanded = 0
  if (entries > 2000 || cursor > end) throw new RateError('INVALID_FILE')
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new RateError('INVALID_FILE')
    expanded += buffer.readUInt32LE(cursor + 24)
    if (expanded > 30 * 1024 * 1024) throw new RateError('INVALID_FILE')
    cursor += 46 + buffer.readUInt16LE(cursor + 28) + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32)
  }
}

export async function importVersion(bytes: Buffer, name: string, actorId: string) {
  validateArchive(bytes)
  let reading: Reading
  try { reading = readWorkbook(bytes) } catch { throw new RateError('INVALID_WORKBOOK') }
  if (reading.values.length > 30000 || reading.values.length === 0) throw new RateError('EMPTY_READING')
  const fileHash = hashFile(bytes)
  const version = await prisma.autonomousRateVersion.create({ data: {
    name: name.replace(/[\r\n\x00-\x1f]/g, '').slice(0, 180), original: bytes, fileHash,
    revision: revisionOf(fileHash, reading), reading: json(reading), createdBy: actorId,
    effectiveFrom: reading.effectiveFrom ? new Date(reading.effectiveFrom) : null,
  }, select: { id: true } })
  return version
}

export async function listVersions() {
  // Do not fetch original bytes in the history list.
  const [versions, registry] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; revision: string; effectiveFrom: Date | null; createdAt: Date; publishedAt: Date | null; count: number }>>`
      SELECT "id", "name", "revision", "effectiveFrom", "createdAt", "publishedAt", jsonb_array_length("reading"->'values') AS count
      FROM "AutonomousRateVersion" ORDER BY "createdAt" DESC, "id" DESC LIMIT 100`,
    prisma.autonomousRateRegistry.findUnique({ where: { id: registryId } }),
  ])
  return { versions, publishedId: registry?.versionId ?? null }
}

export type Filters = { page: number; q?: string; sheet?: string; kind?: ChangeKind }
function compose(candidate: AutonomousRateVersion, reference: AutonomousRateVersion | null, generation: number, filters: Filters): Workspace {
  const after = readingOf(candidate), before = reference ? readingOf(reference) : null
  const issues = [...after.issues]
  if (after.parserVersion !== CURRENT_PARSER_VERSION) issues.push({ code: 'PARSER_VERSION_OUTDATED', sheet: '', blocking: true })
  if (before && (!isSupportedReaderVersion(before.parserVersion) || (before.identityVersion ?? 1) !== (after.identityVersion ?? 1))) issues.push({ code: 'INCOMPATIBLE_READING', sheet: '', blocking: true })
  if ((candidate.effectiveFrom?.toISOString().slice(0, 10) ?? null) !== after.effectiveFrom) issues.push({ code: 'INVALID_EFFECTIVE_DATE', sheet: '', blocking: true })
  if (before && before.sheets.some(sheet => !after.sheets.includes(sheet))) issues.push({ code: 'COVERAGE_LOSS', sheet: '', blocking: true })
  const differences = compareReadings(before, after)
  const counts = { modified: 0, added: 0, absent: 0, unchanged: 0 }
  for (const row of differences) counts[row.kind]++
  const token = { candidateId: candidate.id, candidateRevision: candidate.revision,
    referenceId: reference?.id ?? null, referenceRevision: reference?.revision ?? null, generation }
  const query = filters.q?.toLowerCase() ?? ''
  const filtered = differences.filter(row => {
    const value = row.after ?? row.before!
    return (!filters.kind || row.kind === filters.kind) && (!filters.sheet || value.source.sheet === filters.sheet)
      && (!query || [value.code, value.label, ...value.context].join(' ').toLowerCase().includes(query))
  })
  const date = candidate.effectiveFrom
  const now = new Date()
  const applicable = !!date && date.getTime() <= now.getTime() && (!reference?.effectiveFrom || date >= reference.effectiveFrom)
  if (!applicable) issues.push({ code: 'INVALID_EFFECTIVE_DATE', sheet: '', blocking: true })
  return { candidate: ref(candidate), reference: reference ? ref(reference) : null,
    snapshot: { ...token, digest: snapshotDigest(token) }, counts, issues,
    sheets: [...new Set(differences.map(r => (r.after ?? r.before!).source.sheet))],
    items: filtered.slice((filters.page - 1) * 50, filters.page * 50), total: filtered.length, page: filters.page,
    canPublish: !candidate.publishedAt && !issues.some(i => i.blocking), coverage: after.coverage }
}

export async function getWorkspace(id: string, filters: Filters): Promise<Workspace> {
  // Repeatable snapshot: registry and reference cannot come from different publications.
  return prisma.$transaction(async tx => {
    const candidate = await tx.autonomousRateVersion.findUnique({ where: { id } })
    if (!candidate) throw new RateError('NOT_FOUND', 404)
    const registry = await tx.autonomousRateRegistry.findUnique({ where: { id: registryId } })
    const reference = registry?.versionId ? await tx.autonomousRateVersion.findUnique({ where: { id: registry.versionId } }) : null
    if (registry?.versionId && !reference) throw new RateError('REFERENCE_UNAVAILABLE', 409)
    return compose(candidate, reference, registry?.generation ?? 0, filters)
  }, { isolationLevel: 'RepeatableRead' })
}

export async function publishVersion(id: string, expected: Snapshot, actorId: string) {
  try {
    return await prisma.$transaction(async tx => {
      // Same dedicated lock for first and later publications. No historical cache/event touches.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(728640241)::text AS locked`
      const candidate = await tx.autonomousRateVersion.findUnique({ where: { id } })
      if (!candidate) throw new RateError('NOT_FOUND', 404)
      const existing = await tx.autonomousRatePublication.findUnique({ where: { versionId: id } })
      if (existing) {
        if (digest(existing.snapshot) !== digest(expected)) throw new RateError('STALE_COMPARISON', 409)
        return { id, published: true }
      }
      const registry = await tx.autonomousRateRegistry.findUnique({ where: { id: registryId } })
      if (!registry) throw new RateError('REFERENCE_UNAVAILABLE', 409)
      const reference = registry.versionId ? await tx.autonomousRateVersion.findUnique({ where: { id: registry.versionId } }) : null
      if (registry.versionId && !reference) throw new RateError('REFERENCE_UNAVAILABLE', 409)
      const current = compose(candidate, reference, registry.generation, { page: 1 })
      if (digest(current.snapshot) !== digest(expected)) throw new RateError('STALE_COMPARISON', 409)
      if (!current.canPublish) throw new RateError('BLOCKED')
      // Revalidate both bytes and normalized content; never publish an edited/stale reading.
      const fileHash = hashFile(Buffer.from(candidate.original))
      if (fileHash !== candidate.fileHash || revisionOf(fileHash, readingOf(candidate)) !== candidate.revision
        || digest(readWorkbookVersion(Buffer.from(candidate.original), readingOf(candidate).parserVersion)) !== digest(candidate.reading)) throw new RateError('REVISION_CHANGED', 409)
      if (reference && (hashFile(Buffer.from(reference.original)) !== reference.fileHash
        || (reference.effectiveFrom?.toISOString().slice(0, 10) ?? null) !== readingOf(reference).effectiveFrom
        || revisionOf(reference.fileHash, readingOf(reference)) !== reference.revision
        || digest(readWorkbookVersion(Buffer.from(reference.original), readingOf(reference).parserVersion)) !== digest(reference.reading))) throw new RateError('REVISION_CHANGED', 409)
      await tx.autonomousRatePublication.create({ data: { versionId: id, previousId: registry.versionId, actorId, snapshot: json(expected) } })
      await tx.autonomousRateVersion.update({ where: { id }, data: { publishedAt: new Date() } })
      await tx.autonomousRateRegistry.update({ where: { id: registryId }, data: { versionId: id, generation: { increment: 1 } } })
      return { id, published: true }
    }, { isolationLevel: 'Serializable', timeout: 20000 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) throw new RateError('STALE_COMPARISON', 409)
    throw error
  }
}

export async function getSource(id: string) {
  const version = await prisma.autonomousRateVersion.findUnique({ where: { id }, select: { name: true, original: true, fileHash: true } })
  if (!version) throw new RateError('NOT_FOUND', 404)
  if (hashFile(Buffer.from(version.original)) !== version.fileHash) throw new RateError('REVISION_CHANGED', 409)
  return version
}
