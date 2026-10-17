import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    baremeFile: { findFirst: mocks.findFirst },
    baremeAmount: { findMany: mocks.findMany },
  },
  withDbRetry: <T>(operation: () => Promise<T>) => operation(),
}))

import { getActiveBaremeData, invalidateActiveBaremeCache } from '../getActiveBaremeData'

describe('getActiveBaremeData', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    invalidateActiveBaremeCache()
  })

  it('sélectionne uniquement le barème ONEM publié déjà applicable', async () => {
    const now = new Date('2026-10-16T12:00:00.000Z')
    mocks.findFirst.mockResolvedValue(null)

    await expect(getActiveBaremeData({ force: true, now })).resolves.toBeNull()

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        status: 'published',
        fileType: 'onem-rates',
        validFrom: { lte: now },
      },
      orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        validFrom: true,
        publishedAt: true,
        multiplicateur: true,
      },
    })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('ne partage pas un résultat caché avec une consultation à date de référence', async () => {
    mocks.findFirst
      .mockResolvedValueOnce({
        id: 'current', name: 'current.xlsx', validFrom: new Date('2026-10-01'), publishedAt: new Date(), multiplicateur: null,
      })
      .mockResolvedValueOnce(null)
    mocks.findMany.mockResolvedValue([])

    await getActiveBaremeData()
    await expect(getActiveBaremeData({ now: new Date('2026-01-01') })).resolves.toBeNull()

    expect(mocks.findFirst).toHaveBeenCalledTimes(2)
  })
})
