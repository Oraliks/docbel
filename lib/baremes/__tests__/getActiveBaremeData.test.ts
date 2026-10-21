import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findFiles: vi.fn(),
  findHistory: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    baremeFile: { findMany: mocks.findFiles },
    baremePublicationLog: { findMany: mocks.findHistory },
    baremeAmount: { findMany: mocks.findMany },
  },
  withDbRetry: <T>(operation: () => Promise<T>) => operation(),
}))

import { getActiveBaremeData, invalidateActiveBaremeCache } from '../getActiveBaremeData'

const file = (id = 'v1', validFrom = '2026-01-01', publishedAt = '2026-01-02T10:00:00.000Z') => ({
  id,
  status: 'published',
  publications: [] as Array<{ action: string; details: { reason?: string } }>,
  name: `${id}.xlsx`,
  validFrom: new Date(validFrom),
  publishedAt: new Date(publishedAt),
  updatedAt: new Date(publishedAt),
  multiplicateur: null,
})

const amount = (id: string, value: number) => ({
  id, fileId: 'v1', sourceSheet: 'fixture', category: 'other_unemployment_amount',
  allocationCode: null, salaryCode: null, article: 'Article 60, al. 2',
  labelFr: 'Fixture synthétique', labelNl: null, unit: 'monthly',
  amount: { toNumber: () => value }, minDailySalary: null, maxDailySalary: null,
  validFrom: new Date('2026-01-01'), comparisonKey: id, rawData: {}, createdAt: new Date('2026-01-01'),
})

describe('getActiveBaremeData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'))
    vi.resetAllMocks()
    invalidateActiveBaremeCache()
    mocks.findHistory.mockResolvedValue([])
    mocks.findFiles.mockResolvedValue([file()])
    mocks.findMany.mockResolvedValue([amount('a', 111)])
  })
  afterEach(() => vi.useRealTimers())

  it('exige une vraie publication connue, datée et de la famille ONEM, avec départage stable', async () => {
    mocks.findFiles.mockResolvedValue([])
    await expect(getActiveBaremeData({ asOf: '2026-04-15' })).resolves.toBeNull()

    expect(mocks.findFiles).toHaveBeenCalledWith({
      where: {
        status: { in: ['published', 'archived'] },
        fileType: 'onem-rates',
        validFrom: { lte: new Date('2026-04-15T00:00:00.000Z') },
        publishedAt: { not: null, lte: new Date('2026-10-21T12:00:00.000Z') },
      },
      orderBy: [{ validFrom: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }],
      take: 32,
      select: {
        id: true, status: true, name: true, validFrom: true, publishedAt: true, updatedAt: true, multiplicateur: true,
        publications: {
          where: { action: { in: ['archived', 'revoked'] } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { action: true, details: true, createdAt: true },
        },
      },
    })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('refuse un jour futur ou impossible sans interroger la base', async () => {
    for (const asOf of ['2026-10-22', '2026-02-30', '2026-10-21T12:00:00Z']) {
      await expect(getActiveBaremeData({ asOf })).resolves.toBeNull()
    }
    expect(mocks.findFiles).not.toHaveBeenCalled()
  })

  it('conserve la provenance et les montants synthétiques de v1 archivée puis v2 publiée', async () => {
    mocks.findFiles.mockResolvedValueOnce([file()]).mockResolvedValueOnce([file('v2', '2026-07-01')])
    mocks.findMany.mockResolvedValueOnce([amount('a', 111)]).mockResolvedValueOnce([amount('b', 222)])

    const historical = await getActiveBaremeData({ asOf: '2026-03-01' })
    const current = await getActiveBaremeData({ asOf: '2026-10-21' })
    expect(historical).toMatchObject({ fileId: 'v1', allAmounts: [{ amount: 111 }] })
    expect(current).toMatchObject({ fileId: 'v2', allAmounts: [{ amount: 222 }] })
  })

  it('ne remplace pas une date non couverte par les montants courants déjà en cache', async () => {
    await getActiveBaremeData()
    mocks.findFiles.mockResolvedValueOnce([])
    await expect(getActiveBaremeData({ asOf: '2025-12-31' })).resolves.toBeNull()
    expect(mocks.findMany).toHaveBeenCalledOnce()
  })

  it('relit la publication entre instances tout en réutilisant les montants inchangés', async () => {
    await getActiveBaremeData({ asOf: '2026-04-15' })
    await getActiveBaremeData({ asOf: '2026-04-15' })
    expect(mocks.findFiles).toHaveBeenCalledTimes(2)
    expect(mocks.findMany).toHaveBeenCalledOnce()
  })

  it('propage publication et retrait sans attendre le TTL ni une invalidation locale', async () => {
    await getActiveBaremeData()
    mocks.findFiles.mockResolvedValueOnce([file('v2', '2026-07-01')])
    mocks.findMany.mockResolvedValueOnce([amount('b', 222)])
    expect((await getActiveBaremeData())?.fileId).toBe('v2')
    mocks.findFiles.mockResolvedValueOnce([file()])
    expect((await getActiveBaremeData())?.fileId).toBe('v1')
    mocks.findFiles.mockResolvedValueOnce([])
    await expect(getActiveBaremeData()).resolves.toBeNull()
  })

  it('renouvelle les montants quand updatedAt change et quand force est demandé', async () => {
    await getActiveBaremeData()
    mocks.findMany.mockResolvedValue([amount('a', 222)])
    await getActiveBaremeData({ force: true })
    expect((await getActiveBaremeData())?.allAmounts[0].amount).toBe(222)
    expect(mocks.findMany).toHaveBeenCalledTimes(2)

    mocks.findFiles.mockResolvedValue([{ ...file(), updatedAt: new Date('2026-10-21T11:00:00Z') }])
    mocks.findMany.mockResolvedValue([amount('a', 333)])
    expect((await getActiveBaremeData())?.allAmounts[0].amount).toBe(333)
  })

  it('invalide toutes les dates et ne recharge pas un ancien cache à la fin d’une lecture en cours', async () => {
    await getActiveBaremeData({ asOf: '2026-04-15' })
    await getActiveBaremeData({ asOf: '2026-04-16' })
    invalidateActiveBaremeCache()
    await getActiveBaremeData({ asOf: '2026-04-15' })
    await getActiveBaremeData({ asOf: '2026-04-16' })
    expect(mocks.findMany).toHaveBeenCalledTimes(4)

    let release!: (rows: ReturnType<typeof amount>[]) => void
    mocks.findMany.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const pending = getActiveBaremeData({ asOf: '2026-04-17' })
    await vi.waitFor(() => expect(release).toBeDefined())
    invalidateActiveBaremeCache()
    release([amount('a', 111)])
    await pending
    await getActiveBaremeData({ asOf: '2026-04-17' })
    expect(mocks.findMany).toHaveBeenCalledTimes(6)
  })

  it('borne le nombre de dates conservées en mémoire et expire les montants après cinq minutes', async () => {
    for (let index = 0; index < 33; index++) {
      const asOf = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10)
      await getActiveBaremeData({ asOf })
    }
    await getActiveBaremeData({ asOf: '2026-02-02' })
    expect(mocks.findMany).toHaveBeenCalledTimes(33)
    await getActiveBaremeData({ asOf: '2026-01-01' })
    expect(mocks.findMany).toHaveBeenCalledTimes(34)
    vi.advanceTimersByTime(5 * 60 * 1000)
    await getActiveBaremeData({ asOf: '2026-01-01' })
    expect(mocks.findMany).toHaveBeenCalledTimes(35)
  })

  it('change de jour à minuit Bruxelles même si la date UTC est inchangée', async () => {
    vi.setSystemTime(new Date('2026-07-01T21:59:00Z'))
    await getActiveBaremeData()
    vi.setSystemTime(new Date('2026-07-01T22:01:00Z'))
    await getActiveBaremeData()
    expect(mocks.findFiles.mock.calls.map(([query]) => query.where.validFrom.lte.toISOString())).toEqual([
      '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z',
    ])
    expect(mocks.findMany).toHaveBeenCalledTimes(2)
  })

  it('réévalue une publication future devenue connue même après une absence en cache', async () => {
    mocks.findFiles.mockResolvedValueOnce([]).mockResolvedValueOnce([file('v2', '2026-01-01', '2026-10-21T12:01:00Z')])
    await expect(getActiveBaremeData({ asOf: '2026-04-15' })).resolves.toBeNull()
    vi.advanceTimersByTime(60_000)
    expect((await getActiveBaremeData({ asOf: '2026-04-15' }))?.fileId).toBe('v2')
    expect(mocks.findFiles.mock.calls[1][0].where.publishedAt.lte).toEqual(new Date('2026-10-21T12:01:00Z'))
  })

  it('lit toutes les lignes par pages bornées, en excluant les montants de feuilles futures', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => amount(`a${i}`, 111))
    mocks.findMany.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([amount('last', 222)])
    const data = await getActiveBaremeData({ asOf: '2026-04-15' })
    expect(data?.allAmounts).toHaveLength(1001)
    expect(mocks.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      take: 1000, cursor: { id: 'a999' }, skip: 1,
      where: { fileId: 'v1', OR: [{ validFrom: null }, { validFrom: { lte: new Date('2026-04-15') } }] },
    }))
  })

  it('exclut les archives retirées par un ancien rollback et garde une archive remplacée normalement', async () => {
    mocks.findFiles.mockResolvedValue([
      { ...file('legacy-withdrawn'), status: 'archived', publications: [{ action: 'archived', details: { reason: 'rolled_back_to' } }] },
      { ...file('v1'), status: 'archived', publications: [{ action: 'archived', details: { reason: 'replaced_by' } }] },
    ])
    expect((await getActiveBaremeData({ asOf: '2026-04-15' }))?.fileId).toBe('v1')
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fileId: 'v1' }) }))
  })

  it('ne réutilise pas le cache si la trace d’archivage révèle maintenant un retrait ancien', async () => {
    await getActiveBaremeData({ asOf: '2026-04-15' })
    mocks.findFiles.mockResolvedValue([
      { ...file(), status: 'archived', publications: [{ action: 'archived', details: { reason: 'rolled_back_to' } }] },
    ])
    await expect(getActiveBaremeData({ asOf: '2026-04-15' })).resolves.toBeNull()
    expect(mocks.findMany).toHaveBeenCalledOnce()
  })

  it('continue la recherche par pages si toutes les premières archives étaient retirées', async () => {
    const withdrawn = Array.from({ length: 32 }, (_, index) => ({
      ...file(`withdrawn-${index}`), status: 'archived',
      publications: [{ action: 'archived', details: { reason: 'rolled_back_to' } }],
    }))
    mocks.findFiles.mockResolvedValueOnce(withdrawn).mockResolvedValueOnce([file()])
    expect((await getActiveBaremeData({ asOf: '2026-04-15' }))?.fileId).toBe('v1')
    expect(mocks.findFiles).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: { id: 'withdrawn-31' }, skip: 1, take: 32,
    }))
  })

  it.each(['2026-10-21', '2026-04-15'])('un ancien retour C vers A retire aussi B pour la consultation du %s', async (asOf) => {
    const restored = file('A', '2026-01-01', '2026-07-01T12:00:00Z')
    const intermediate = { ...file('B', '2026-03-01', '2026-03-01T12:00:00Z'), status: 'archived',
      publications: [{ action: 'archived', createdAt: new Date('2026-06-01T12:00:00Z'), details: { reason: 'replaced_by' } }] }
    const removed = { ...file('C', '2026-06-01', '2026-06-01T12:00:00Z'), status: 'archived',
      publications: [{ action: 'archived', createdAt: new Date('2026-07-01T12:00:01Z'), details: { reason: 'rolled_back_to' } }] }
    mocks.findHistory.mockResolvedValue([{
      id: 'legacy-C-archive', action: 'archived', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: { reason: 'rolled_back_to', rolledBackToId: 'A' }, file: removed,
    }])
    mocks.findFiles.mockImplementation(async (query) => query.where.id
      ? [restored]
      : (asOf === '2026-04-15' ? [intermediate, restored] : [removed, intermediate, restored]))
    expect((await getActiveBaremeData({ asOf }))?.fileId).toBe('A')
    expect(mocks.findHistory).toHaveBeenCalledWith(expect.objectContaining({
      take: 32,
      where: {
        file: { fileType: 'onem-rates' }, createdAt: { lte: new Date('2026-10-21T12:00:00Z') },
        OR: [{ action: 'rollback' }, { action: 'archived', details: { path: ['reason'], equals: 'rolled_back_to' } }],
      },
    }))
  })

  it('respecte la trace du retour vers A même si la trace d’archivage de C manque', async () => {
    const restored = file('A', '2026-01-01', '2026-07-01T12:00:00Z')
    const intermediate = { ...file('B', '2026-03-01', '2026-03-01T12:00:00Z'), status: 'archived' }
    mocks.findHistory.mockResolvedValue([{
      id: 'legacy-A-rollback', action: 'rollback', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: { archivedPreviousId: 'C' }, file: restored,
    }])
    mocks.findFiles.mockResolvedValue([intermediate, restored])
    expect((await getActiveBaremeData())?.fileId).toBe('A')
  })

  it('réadmet B réellement republié après l’ancien retrait puis normalement archivé', async () => {
    const restored = file('A', '2026-01-01', '2026-07-01T12:00:00Z')
    const republished = { ...file('B', '2026-03-01', '2026-08-01T12:00:00Z'), status: 'archived',
      publications: [{ action: 'archived', createdAt: new Date('2026-09-01T12:00:00Z'), details: { reason: 'replaced_by' } }] }
    mocks.findHistory.mockResolvedValue([{
      id: 'legacy-A-rollback', action: 'rollback', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: {}, file: restored,
    }])
    mocks.findFiles.mockResolvedValue([republished, restored])
    expect((await getActiveBaremeData({ asOf: '2026-04-15' }))?.fileId).toBe('B')
  })

  it('réadmet une version restaurée après le retrait même lorsque sa première publishedAt est conservée', async () => {
    const first = file('A', '2026-01-01', '2026-01-02T12:00:00Z')
    const restoredLater = { ...file('B', '2026-03-01', '2026-03-01T12:00:00Z'), status: 'archived',
      publications: [{ action: 'archived', createdAt: new Date('2026-07-01T12:00:01Z'), details: { reason: 'rolled_back_to' } }] }
    mocks.findHistory.mockResolvedValue([
      { id: 'later-B-rollback', action: 'rollback', createdAt: new Date('2026-08-01T12:00:01Z'), details: {}, file: restoredLater },
      { id: 'legacy-A-rollback', action: 'rollback', createdAt: new Date('2026-07-01T12:00:01Z'), details: {}, file: first },
    ])
    mocks.findFiles.mockResolvedValue([restoredLater, first])
    expect((await getActiveBaremeData())?.fileId).toBe('B')
  })

  it('applique aussi les critères publishedAt puis id aux anciennes révisions de même date', async () => {
    const target = file('same-A', '2026-01-01', '2026-01-02T12:00:00Z')
    const sameTimestamp = { ...file('same-B', '2026-01-01', '2026-01-02T12:00:00Z'), status: 'archived' }
    const laterPublication = { ...file('same-C', '2026-01-01', '2026-01-03T12:00:00Z'), status: 'archived' }
    mocks.findHistory.mockResolvedValue([{
      id: 'same-date-rollback', action: 'rollback', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: {}, file: target,
    }])
    mocks.findFiles.mockResolvedValue([laterPublication, sameTimestamp, target])
    expect((await getActiveBaremeData())?.fileId).toBe('same-A')
  })

  it('ne choisit pas un intermédiaire lorsque la cible d’un ancien retrait est introuvable', async () => {
    mocks.findHistory.mockResolvedValue([{
      id: 'legacy-missing-target', action: 'archived', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: { reason: 'rolled_back_to', rolledBackToId: 'missing-A' }, file: file('C'),
    }])
    mocks.findFiles.mockImplementation(async (query) => query.where.id ? [] : [file('B')])
    await expect(getActiveBaremeData()).resolves.toBeNull()
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('pagine également les journaux au-delà de 32 événements', async () => {
    const target = file('A')
    const page = Array.from({ length: 32 }, (_, index) => ({
      id: `rollback-${index}`, action: 'rollback', createdAt: new Date('2026-07-01T12:00:01Z'),
      details: {}, file: target,
    }))
    mocks.findHistory.mockResolvedValueOnce(page).mockResolvedValueOnce([])
    mocks.findFiles.mockResolvedValue([target])
    expect((await getActiveBaremeData())?.fileId).toBe('A')
    expect(mocks.findHistory).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: { id: 'rollback-31' }, skip: 1, take: 32,
    }))
  })
})
