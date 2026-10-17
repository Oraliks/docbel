import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaremeComparisonSnapshot } from '../types'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({ file: vi.fn(), transaction: vi.fn(), current: vi.fn(), published: vi.fn(), update: vi.fn(), log: vi.fn(), compare: vi.fn(), blob: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file }, $transaction: mocks.transaction }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('../compareBaremeVersions', async (original) => ({ ...await original<typeof import('../compareBaremeVersions')>(), compareBaremeVersions: mocks.compare }))
vi.mock('@/lib/storage/blob-storage', () => ({ getBlob: mocks.blob, isPrivateBlobPath: (path: string) => path?.startsWith('blobs:https://fixture.private.') }))
import { recordBaremeComparisonReview, refreshBaremeComparison } from '../comparisonReview'

const reference = { id: 'A', name: 'A', status: 'published', fileType: 'test', validFrom: '2026-01-01', dataRevision: 'A-data' }
const snapshot = (ref: typeof reference | null = null): BaremeComparisonSnapshot => ({ version: 1, state: ref ? 'computed' : 'first_import', candidate: { ...reference, id: 'C', dataRevision: 'C-data' }, reference: ref, computedAt: '2026-01-01T00:00:00.000Z' })
function setup(saved = snapshot(), status = 'draft') {
  const file = { id: 'C', fileType: 'test', status, diagnostics: { comparison: saved, unknownCodes: ['preserved'], structuralAlerts: [] }, alerts: [], summary: {} }
  mocks.file.mockResolvedValue(file)
  mocks.current.mockResolvedValue(file)
  mocks.published.mockResolvedValue(saved.reference)
  mocks.compare.mockResolvedValue({ ...saved, changes: [], countsByType: { added: 0, modified: 0, disappeared: 0 }, candidateDataRevision: saved.candidate.dataRevision, referenceDataRevision: saved.reference?.dataRevision ?? null })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ baremeFile: { findUnique: mocks.current, findFirst: mocks.published, update: mocks.update }, baremePublicationLog: { create: mocks.log } }))
  setup()
})
describe('revue et renouvellement de comparaison', () => {
  it('enregistre une revue de premier import sans inventer de référence', async () => {
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot())).resolves.toMatchObject({ status: 'reviewed', snapshot: { reference: null } })
    expect(mocks.compare).toHaveBeenCalledWith('C', null)
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'comparison_reviewed' }) }))
  })
  it('refuse une référence remplacée sans écrire de revue', async () => {
    setup(snapshot(reference)); mocks.published.mockResolvedValue({ id: 'B' })
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot(reference))).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('renouvelle C vers B sans réimport et conserve diagnostics et ancienne paire', async () => {
    const old = snapshot(reference); setup(old)
    const next = { ...reference, id: 'B', dataRevision: 'B-data' }
    mocks.compare.mockResolvedValue({ ...old, changes: [], countsByType: { added: 0, modified: 0, disappeared: 0 }, reference: next, candidateDataRevision: 'C-data', referenceDataRevision: 'B-data' })
    mocks.published.mockResolvedValue(next)
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ status: 'refreshed', snapshot: { reference: { id: 'B' } } })
    expect(mocks.compare).toHaveBeenCalledWith('C', undefined)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ diagnostics: expect.objectContaining({ unknownCodes: ['preserved'], comparison: expect.objectContaining({ reference: next }) }) }) }))
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'comparison_refreshed', details: expect.objectContaining({ previousComparison: old }) }) }))
  })
  it('refuse une modification concurrente du snapshot', async () => {
    mocks.current.mockResolvedValue({ status: 'draft', diagnostics: {} })
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('ne réécrit pas une archive ni un import sans snapshot historique', async () => {
    setup(snapshot(reference), 'archived')
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ reason: 'not_draft' })
    mocks.file.mockResolvedValue({ status: 'draft', diagnostics: null })
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ reason: 'unavailable' })
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('ne confirme pas une revue si sa preuve ne peut être conservée', async () => {
    mocks.log.mockRejectedValue(new Error('journal unavailable'))
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot())).rejects.toThrow('journal unavailable')
  })

  it('refuse le clic d’un écran C/A après un renouvellement vers C/B', async () => {
    setup(snapshot({ ...reference, id: 'B' }))
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot(reference))).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled(); expect(mocks.compare).not.toHaveBeenCalled()
  })
  it('refuse aussi le renouvellement concurrent intervenu après lecture du contexte attendu', async () => {
    setup(snapshot(reference))
    mocks.current.mockResolvedValue({ status: 'draft', diagnostics: { comparison: snapshot({ ...reference, id: 'B' }) } })
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot(reference))).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it.each(['computedAt', 'candidateRevision', 'referenceRevision', 'referenceAbsent'] as const)('refuse un contexte affiché différent : %s', async (change) => {
    const displayed = snapshot(reference)
    const saved = structuredClone(displayed)
    if (change === 'computedAt') saved.computedAt = '2026-01-02T00:00:00.000Z'
    if (change === 'candidateRevision') saved.candidate.dataRevision = 'new-candidate-data'
    if (change === 'referenceRevision') saved.reference!.dataRevision = 'new-reference-data'
    if (change === 'referenceAbsent') saved.reference = null
    setup(saved)
    await expect(recordBaremeComparisonReview('C', 'admin@test', displayed)).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('retourne un conflit après un échec de sérialisation transactionnel', async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Write conflict', { code: 'P2034', clientVersion: '5.22' }))
    await expect(recordBaremeComparisonReview('C', 'admin@test', snapshot())).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it.each(['unmarked', 'wrongHash', 'wrongSize', 'publicSource', 'archived'] as const)('refuse une reprise sans preuve cohérente : %s', async (change) => {
    const file = { id: 'C', status: 'draft', fileType: 'test', filePath: 'blobs:https://fixture.private.blob.vercel-storage.com/C', fileHash: 'hash', fileSize: 10,
      diagnostics: { comparisonPending: { version: 1, fileHash: 'hash', fileSize: 10 } } as Record<string, unknown> }
    if (change === 'unmarked') file.diagnostics = {}
    if (change === 'wrongHash') file.fileHash = 'changed'
    if (change === 'wrongSize') file.fileSize = 11
    if (change === 'publicSource') file.filePath = 'blobs:https://fixture.public.blob.vercel-storage.com/C'
    if (change === 'archived') file.status = 'archived'
    mocks.file.mockResolvedValue(file)
    expect((await refreshBaremeComparison('C', 'admin@test')).status).toBe('error')
    expect(mocks.blob).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('reprend seulement un nouvel import marqué après vérification des octets privés', async () => {
    const bytes = Buffer.from('source exacte')
    const hash = createHash('sha256').update(bytes).digest('hex')
    const file = { id: 'C', status: 'draft', fileType: 'test', filePath: 'blobs:https://fixture.private.blob.vercel-storage.com/C', fileHash: hash, fileSize: bytes.length, diagnostics: { comparisonPending: { version: 1, fileHash: hash, fileSize: bytes.length }, structuralAlerts: [] }, alerts: [], summary: {} }
    mocks.file.mockResolvedValue(file); mocks.current.mockResolvedValue(file); mocks.blob.mockResolvedValue(bytes)
    const result = await refreshBaremeComparison('C', 'admin@test')
    expect(result.status).toBe('refreshed')
    const data = mocks.update.mock.calls[0][0].data
    expect(data.diagnostics.comparisonPending).toBeUndefined()
    expect(data.diagnostics.comparison.candidate.id).toBe('C')
    mocks.blob.mockResolvedValue(Buffer.from('corruption'))
    mocks.update.mockClear()
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ reason: 'unavailable' })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
