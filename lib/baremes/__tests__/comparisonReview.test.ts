import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaremeComparisonSnapshot } from '../types'

const mocks = vi.hoisted(() => ({ file: vi.fn(), transaction: vi.fn(), current: vi.fn(), published: vi.fn(), update: vi.fn(), log: vi.fn(), compare: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file }, $transaction: mocks.transaction }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('../compareBaremeVersions', () => ({ compareBaremeVersions: mocks.compare, comparisonSnapshot: (diff: { candidate: unknown; reference: unknown; state: string }) => ({ version: 1, candidate: diff.candidate, reference: diff.reference, state: diff.state, computedAt: new Date().toISOString() }) }))
import { recordBaremeComparisonReview, refreshBaremeComparison } from '../comparisonReview'

const reference = { id: 'A', name: 'A', status: 'published', fileType: 'test', validFrom: '2026-01-01', dataRevision: 'A-data' }
const snapshot = (ref: typeof reference | null = null): BaremeComparisonSnapshot => ({ version: 1, state: ref ? 'computed' : 'first_import', candidate: { ...reference, id: 'C', dataRevision: 'C-data' }, reference: ref, computedAt: '2026-01-01T00:00:00.000Z' })
function setup(saved = snapshot(), status = 'draft') {
  const file = { id: 'C', fileType: 'test', status, diagnostics: { comparison: saved, unknownCodes: ['preserved'] } }
  mocks.file.mockResolvedValue(file)
  mocks.current.mockResolvedValue(file)
  mocks.published.mockResolvedValue(saved.reference)
  mocks.compare.mockResolvedValue({ ...saved, candidateDataRevision: saved.candidate.dataRevision, referenceDataRevision: saved.reference?.dataRevision ?? null })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ baremeFile: { findUnique: mocks.current, findFirst: mocks.published, update: mocks.update }, baremePublicationLog: { create: mocks.log } }))
  setup()
})
describe('revue et renouvellement de comparaison', () => {
  it('enregistre une revue de premier import sans inventer de référence', async () => {
    await expect(recordBaremeComparisonReview('C', 'admin@test')).resolves.toMatchObject({ status: 'reviewed', snapshot: { reference: null } })
    expect(mocks.compare).toHaveBeenCalledWith('C', null)
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'comparison_reviewed' }) }))
  })
  it('refuse une référence remplacée sans écrire de revue', async () => {
    setup(snapshot(reference)); mocks.published.mockResolvedValue({ id: 'B' })
    await expect(recordBaremeComparisonReview('C', 'admin@test')).resolves.toMatchObject({ reason: 'stale' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
  it('renouvelle C vers B sans réimport et conserve diagnostics et ancienne paire', async () => {
    const old = snapshot(reference); setup(old)
    const next = { ...reference, id: 'B', dataRevision: 'B-data' }
    mocks.compare.mockResolvedValue({ ...old, reference: next, candidateDataRevision: 'C-data', referenceDataRevision: 'B-data' })
    mocks.published.mockResolvedValue(next)
    await expect(refreshBaremeComparison('C', 'admin@test')).resolves.toMatchObject({ status: 'refreshed', snapshot: { reference: { id: 'B' } } })
    expect(mocks.compare).toHaveBeenCalledWith('C', undefined)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { diagnostics: expect.objectContaining({ unknownCodes: ['preserved'], comparison: expect.objectContaining({ reference: next }) }) } }))
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
    await expect(recordBaremeComparisonReview('C', 'admin@test')).rejects.toThrow('journal unavailable')
  })
})
