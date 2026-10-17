import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), findFirst: vi.fn(), compare: vi.fn(), getBlob: vi.fn(),
  isBlob: vi.fn(), hash: vi.fn(), readFile: vi.fn(),
}))

vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findFirst: mocks.findFirst } } }))
vi.mock('@/lib/baremes/onemSync', () => ({
  ONEM_BAREME_HUB_URL: 'https://www.onem.be/documentation/montants',
  compareWithPublishedOnem: mocks.compare,
}))
vi.mock('@/lib/storage/blob-storage', () => ({ getBlob: mocks.getBlob, isBlobsPath: mocks.isBlob }))
vi.mock('@/lib/baremes/hash', () => ({ sha256: mocks.hash }))
vi.mock('fs/promises', () => ({ readFile: mocks.readFile }))

import { GET } from '@/app/api/baremes/onem-check/route'

const sameDate = new Date('2026-07-01T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@example.test' } })
  mocks.findFirst.mockResolvedValue({
    id: 'onem-1', name: 'barema-new-01072026.xlsx',
    filePath: 'blobs:https://docbel.private.blob.vercel-storage.com/source.xlsx',
    fileHash: 'known-hash', fileSize: Buffer.byteLength('source'), validFrom: sameDate,
  })
  mocks.isBlob.mockReturnValue(true)
  mocks.getBlob.mockResolvedValue(Buffer.from('source'))
  mocks.hash.mockReturnValue('known-hash')
})

describe('GET /api/baremes/onem-check', () => {
  it('uses the private blob original and reports a content-backed match', async () => {
    mocks.compare.mockResolvedValue({
      identical: true,
      counts: { commonSheets: 2, onlyInOurs: 0, onlyInTheirs: 0, changedSheets: 0, changedCells: 0 },
      onlyInOurs: [], onlyInTheirs: [],
      onem: { url: 'https://www.onem.be/file/barema-new-01072026.xlsx', fileName: 'barema-new-01072026.xlsx', validFrom: sameDate },
    })
    const response = await GET()
    const body = await response.json()
    expect(mocks.getBlob).toHaveBeenCalledWith(expect.stringContaining('blobs:'))
    expect(body.status).toBe('content_match')
    expect(body.message).not.toMatch(/à jour/i)
    expect(body.diff.identical).toBe(true)
  })

  it('does not turn an unavailable external comparison into a positive result', async () => {
    mocks.compare.mockResolvedValue(null)
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.status).toBe('external_unavailable')
  })

  it('refuses an internal source whose persisted size no longer matches', async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: 'onem-1', name: 'barema-new-01072026.xlsx',
      filePath: 'blobs:https://docbel.private.blob.vercel-storage.com/source.xlsx',
      fileHash: 'known-hash', fileSize: 999, validFrom: sameDate,
    })

    const body = await (await GET()).json()

    expect(body.status).toBe('inconclusive')
    expect(body.reason).toBe('original_integrity_mismatch')
    expect(mocks.compare).not.toHaveBeenCalled()
  })

  it('reports a same-date content change rather than treating the date as proof', async () => {
    mocks.compare.mockResolvedValue({
      identical: false,
      counts: { commonSheets: 2, onlyInOurs: 0, onlyInTheirs: 0, changedSheets: 1, changedCells: 1 },
      onlyInOurs: [], onlyInTheirs: [],
      onem: { url: 'https://www.onem.be/file/barema-new-01072026.xlsx', fileName: 'barema-new-01072026.xlsx', validFrom: sameDate },
    })
    const body = await (await GET()).json()
    expect(body.status).toBe('content_different_same_date')
    expect(body.diff.counts.changedCells).toBe(1)
  })
})
