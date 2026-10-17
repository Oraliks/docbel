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
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: mocks.transaction },
  withDbRetry: <T>(operation: () => Promise<T>) => operation(),
}))
vi.mock('../getActiveBaremeData', () => ({ invalidateActiveBaremeCache: mocks.invalidate }))
vi.mock('../publicationLog', () => ({ logPublicationEvent: mocks.log }))

import { publishBaremeImport } from '../publishBaremeImport'
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
  vi.clearAllMocks()
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({
      baremeFile: {
        findUnique: mocks.findUnique,
        findFirst: mocks.findFirst,
        update: mocks.update,
        updateMany: mocks.updateMany,
      },
      baremePublicationLog: { findFirst: mocks.findReview },
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
