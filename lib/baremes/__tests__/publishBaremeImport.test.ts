import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
  invalidate: vi.fn(),
  log: vi.fn(),
  findReview: vi.fn(),
  findMany: vi.fn(),
  createLogs: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
  withDbRetry: <T>(operation: () => Promise<T>) => operation(),
}))
vi.mock('../getActiveBaremeData', () => ({ invalidateActiveBaremeCache: mocks.invalidate }))
vi.mock('../publicationLog', () => ({ logPublicationEvent: mocks.log }))

import { publishBaremeImport, rollbackToVersion } from '../publishBaremeImport'
import { extractLatestBaremeRefFromHtml, fetchLatestOnemBaremeUrl } from '../onemSync'

const past = new Date('2026-01-01T00:00:00.000Z')

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    status: 'draft',
    fileType: 'onem-rates',
    alerts: [],
    validFrom: past,
    requiresApproval: false,
    fileHash: 'abc',
    filePath: 'private/uploads/baremes/source.xlsx',
    diagnostics: {
      comparison: {
        version: 1,
        state: 'computed',
        candidate: { id: 'draft-1', name: 'draft.xlsx', status: 'draft', fileType: 'onem-rates', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'candidate-revision' },
        reference: { id: 'previous-1', name: 'previous.xlsx', status: 'published', fileType: 'onem-rates', validFrom: '2025-01-01T00:00:00.000Z', dataRevision: 'reference-revision' },
        computedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      baremeFile: {
        findUnique: mocks.findUnique,
        findFirst: mocks.findFirst,
        findMany: mocks.findMany,
        update: mocks.update,
        updateMany: mocks.updateMany,
      },
      baremePublicationLog: { findFirst: mocks.findReview, createMany: mocks.createLogs },
    })
  )
  mocks.findReview.mockResolvedValue({ details: { comparison: candidate().diagnostics.comparison } })
})

describe('publishBaremeImport', () => {
  it('bloque une date d’effet absente avant d’archiver le publié courant', async () => {
    mocks.findUnique.mockResolvedValue(candidate({ validFrom: null }))

    await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({
      status: 'error',
      reason: 'missing_valid_from',
    })
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('conserve un barème futur en brouillon', async () => {
    mocks.findUnique.mockResolvedValue(candidate({ validFrom: new Date('2099-01-01T00:00:00.000Z') }))

    await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({
      status: 'error',
      reason: 'future_valid_from',
    })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })


  it('publie un barème entré en vigueur au jour civil Bruxelles avant minuit UTC', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T22:30:00Z'))
    try {
      mocks.findUnique.mockResolvedValue(candidate({ validFrom: new Date('2026-07-02T00:00:00Z') }))
      mocks.findFirst.mockResolvedValue({ id: 'previous-1' })
      mocks.update.mockResolvedValue({ id: 'previous-1' })
      mocks.updateMany.mockResolvedValue({ count: 1 })
      await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({ status: 'published' })
    } finally {
      vi.useRealTimers()
    }
  })
  it('ne laisse plus force contourner une erreur de diagnostic', async () => {
    mocks.findUnique.mockResolvedValue(candidate({ alerts: [{ level: 'error' }] }))

    await expect(publishBaremeImport('draft-1', { force: true })).resolves.toMatchObject({
      status: 'error',
      reason: 'has_errors',
    })
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })

  it('archive uniquement le publié de la même famille puis publie le draft', async () => {
    mocks.findUnique.mockResolvedValue(candidate())
    mocks.findFirst.mockResolvedValue({ id: 'previous-1' })
    mocks.update.mockResolvedValue({ id: 'previous-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })

    await expect(publishBaremeImport('draft-1', { publishedBy: 'admin@example.test' })).resolves.toEqual({
      status: 'published',
      fileId: 'draft-1',
      archivedPreviousId: 'previous-1',
    })
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ fileType: 'onem-rates', status: 'published' }),
    }))
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it('refuse une publication sans revue explicite de la paire mémorisée', async () => {
    mocks.findUnique.mockResolvedValue(candidate())
    mocks.findFirst.mockResolvedValue({ id: 'previous-1' })
    mocks.findReview.mockResolvedValue(null)
    await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({ status: 'error', reason: 'comparison_not_reviewed' })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('publie un premier import revu sans référence', async () => {
    const file = candidate()
    const comparison = { ...file.diagnostics.comparison, state: 'first_import', reference: null }
    mocks.findUnique.mockResolvedValue({ ...file, diagnostics: { comparison } })
    mocks.findFirst.mockResolvedValue(null)
    mocks.findReview.mockResolvedValue({ details: { comparison } })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({ status: 'published', archivedPreviousId: null })
  })

  it('exige une nouvelle revue après renouvellement, même avec les mêmes empreintes', async () => {
    const file = candidate()
    file.diagnostics.comparison.computedAt = '2026-01-02T00:00:00.000Z'
    mocks.findUnique.mockResolvedValue(file)
    mocks.findFirst.mockResolvedValue({ id: 'previous-1' })
    await expect(publishBaremeImport('draft-1')).resolves.toMatchObject({ reason: 'comparison_stale' })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('signale un conflit au double appel au lieu de confirmer deux publications', async () => {
    mocks.findUnique.mockResolvedValue(candidate())
    mocks.findFirst.mockResolvedValue({ id: 'previous-1' })
    mocks.update.mockResolvedValue({ id: 'previous-1' })
    // Représente l’UPDATE conditionnel de la seconde requête, après que la
    // première a déjà changé le statut du brouillon.
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    const results = await Promise.all([
      publishBaremeImport('draft-1', { publishedBy: 'admin@example.test' }),
      publishBaremeImport('draft-1', { publishedBy: 'admin@example.test' }),
    ])

    expect(results.map((result) => result.status).sort()).toEqual(['error', 'published'])
    expect(results).toContainEqual(expect.objectContaining({ reason: 'concurrent_update' }))
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })
})

describe('ONEM remote source protections', () => {
  it('ignore un lien xlsx barema qui quitte le domaine officiel', () => {
    expect(
      extractLatestBaremeRefFromHtml(
        '<a href="https://example.test/barema-new-01012026.xlsx">faux</a>',
        'https://www.onem.be/documentation/montants'
      )
    ).toBeNull()
  })

  it('refuse une redirection du hub vers un autre domaine', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.test/' } })
    ) as unknown as typeof fetch

    await expect(fetchLatestOnemBaremeUrl(fetchImpl)).resolves.toBeNull()
  })
})

describe('rollbackToVersion', () => {
  const archived = (overrides: Record<string, unknown> = {}) => ({
    id: 'A', status: 'archived', fileType: 'onem-rates',
    validFrom: new Date('2026-01-01T00:00:00Z'),
    publishedAt: new Date('2026-01-02T12:00:00Z'),
    ...overrides,
  })

  it.each([
    { publishedAt: null },
    { publishedAt: new Date('2099-01-01T00:00:00Z') },
    { validFrom: null },
    { validFrom: new Date('2099-01-01T00:00:00Z') },
    { status: 'revoked' },
    { status: 'draft' },
  ])('refuse une archive sans publication applicable vérifiable : %s', async (overrides) => {
    mocks.findUnique.mockResolvedValue(archived(overrides))
    await expect(rollbackToVersion('A')).resolves.toMatchObject({ status: 'error' })
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it('retire B et C lors du rollback C vers A et conserve la première publication de A', async () => {
    mocks.findUnique.mockResolvedValue(archived())
    mocks.findFirst.mockResolvedValue({ id: 'C' })
    mocks.findMany.mockResolvedValue([{ id: 'B', status: 'archived' }, { id: 'C', status: 'published' }])
    mocks.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 })
    mocks.createLogs.mockResolvedValue({ count: 3 })

    await expect(rollbackToVersion('A', 'admin@example.test')).resolves.toEqual({
      status: 'rolled_back', archivedPreviousId: 'C', revokedFileIds: ['B', 'C'],
    })
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        fileType: 'onem-rates',
        NOT: { id: 'A' },
        OR: [
          { status: 'published' },
          { status: 'archived', publishedAt: { not: null }, OR: [
            { validFrom: { gt: new Date('2026-01-01T00:00:00Z') } },
            { validFrom: new Date('2026-01-01T00:00:00Z'), publishedAt: { gt: new Date('2026-01-02T12:00:00Z') } },
            { validFrom: new Date('2026-01-01T00:00:00Z'), publishedAt: new Date('2026-01-02T12:00:00Z'), id: { gt: 'A' } },
          ] },
        ],
      },
      orderBy: { id: 'asc' }, take: 1000, select: { id: true, status: true },
    })
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { status: 'revoked' } }))
    expect(mocks.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'A', status: 'archived' },
      data: { status: 'published', publishedBy: 'admin@example.test' },
    })
    expect(mocks.createLogs).toHaveBeenCalledWith({ data: [
      { fileId: 'B', action: 'revoked', fromStatus: 'archived', toStatus: 'revoked', actorEmail: 'admin@example.test', details: { reason: 'rolled_back_to', rolledBackToId: 'A' } },
      { fileId: 'C', action: 'revoked', fromStatus: 'published', toStatus: 'revoked', actorEmail: 'admin@example.test', details: { reason: 'rolled_back_to', rolledBackToId: 'A' } },
      { fileId: 'A', action: 'rollback', fromStatus: 'archived', toStatus: 'published', actorEmail: 'admin@example.test', details: { archivedPreviousId: 'C', revokedFileIds: ['B', 'C'] } },
    ] })
    expect(mocks.invalidate).toHaveBeenCalledOnce()
  })

  it('retire les révisions de même date qui gagnent par publishedAt puis par id', async () => {
    mocks.findUnique.mockResolvedValue(archived({ id: 'revision-B' }))
    mocks.findFirst.mockResolvedValue({ id: 'revision-D' })
    mocks.findMany.mockResolvedValue([{ id: 'revision-C', status: 'archived' }, { id: 'revision-D', status: 'published' }])
    mocks.updateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 1 })
    const result = await rollbackToVersion('revision-B')
    expect(result).toMatchObject({ revokedFileIds: ['revision-C', 'revision-D'] })
    expect(mocks.findMany.mock.calls[0][0].where.OR[1].OR[2]).toEqual({
      validFrom: new Date('2026-01-01T00:00:00Z'),
      publishedAt: new Date('2026-01-02T12:00:00Z'),
      id: { gt: 'revision-B' },
    })
  })

  it('ne confirme pas ni ne cache une restauration si une version a changé concurremment', async () => {
    mocks.findUnique.mockResolvedValue(archived())
    mocks.findFirst.mockResolvedValue({ id: 'C' })
    mocks.findMany.mockResolvedValue([{ id: 'C', status: 'published' }])
    mocks.updateMany.mockResolvedValueOnce({ count: 0 })
    await expect(rollbackToVersion('A')).resolves.toMatchObject({ status: 'error' })
    expect(mocks.createLogs).not.toHaveBeenCalled()
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it('laisse échouer la transaction si sa trace atomique ne peut pas être créée', async () => {
    mocks.findUnique.mockResolvedValue(archived())
    mocks.findFirst.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([])
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.createLogs.mockRejectedValueOnce(new Error('fixture journal unavailable'))
    await expect(rollbackToVersion('A')).rejects.toThrow('fixture journal unavailable')
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
})
