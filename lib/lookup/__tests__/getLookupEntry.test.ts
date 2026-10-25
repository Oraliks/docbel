import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  table: { findMany: vi.fn() },
  entry: { findMany: vi.fn(), groupBy: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({ lookupTable: mocks.table, lookupEntry: mocks.entry }),
    lookupTable: mocks.table,
    lookupEntry: mocks.entry,
  },
  withDbRetry: (callback: () => unknown) => callback(),
}))

import { invalidateLookupCache, parseLookupCivilDate, resolveLookupEntry, resolveLookupEntriesByCodes } from '../getLookupEntry'

const table = {
  id: 'table-id', slug: 'example', labelFr: 'Exemple', publishedRevision: 4,
  lastImportedAt: new Date('2026-10-20T10:00:00Z'), category: { slug: 'category' },
}
const row = {
  id: 'entry-1', code: 'X', labelFr: 'Valeur', labelNl: 'Waarde', labelDe: null,
  labelEn: null, validFrom: new Date('2020-01-01T00:00:00Z'),
  validUntil: new Date('2026-10-25T00:00:00Z'), notes: null,
}

describe('Lookup dated resolution', () => {
  beforeEach(() => {
    invalidateLookupCache()
    vi.clearAllMocks()
    mocks.table.findMany.mockResolvedValue([table])
  })

  it('uses inclusive UTC civil-day boundaries and returns publication provenance', async () => {
    mocks.entry.findMany.mockResolvedValue([row])
    const result = await resolveLookupEntry('example', 'X', { asOf: '2026-10-25' })
    expect(result.status).toBe('resolved')
    if (result.status !== 'resolved') throw new Error('expected resolved')
    expect(result.entry.effectiveDate).toBe('2026-10-25')
    expect(result.entry.publishedRevision).toBe(4)
    const query = mocks.entry.findMany.mock.calls[0][0]
    expect(query.where.AND[0].OR[1].validFrom.lte.toISOString()).toBe('2026-10-25T00:00:00.000Z')
    expect(query.where.AND[1].OR[1].validUntil.gte.toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })

  it('rejects invalid requested dates', async () => {
    expect(() => parseLookupCivilDate('2026-02-30')).toThrow('Date Lookup invalide')
    await expect(resolveLookupEntry('example', 'X', { asOf: 'not-a-date' })).rejects.toThrow('Date Lookup invalide')
    expect(mocks.entry.findMany).not.toHaveBeenCalled()
  })

  it('reports overlapping valid rows as ambiguous for unit and batch resolution', async () => {
    mocks.entry.findMany.mockResolvedValue([row, { ...row, id: 'entry-2', validFrom: new Date('2022-01-01T00:00:00Z') }])
    mocks.entry.groupBy.mockResolvedValue([{ code: 'X', _count: { _all: 2 } }])
    expect((await resolveLookupEntry('example', 'X', { asOf: '2024-01-01' })).status).toBe('ambiguous')
    const batch = await resolveLookupEntriesByCodes('example', ['X'], { asOf: '2024-01-01' })
    expect(batch.get('X')?.status).toBe('ambiguous')
  })

  it('does not choose a table silently when slugs collide across categories', async () => {
    mocks.table.findMany.mockResolvedValue([table, { ...table, id: 'table-id-2' }])

    const single = await resolveLookupEntry('example', 'X', { asOf: '2024-01-01' })
    const batch = await resolveLookupEntriesByCodes('example', ['X'], { asOf: '2024-01-01' })

    expect(single).toMatchObject({ status: 'ambiguous', ambiguity: 'table', candidates: 2 })
    expect(batch.get('X')).toMatchObject({ status: 'ambiguous', ambiguity: 'table', candidates: 2 })
    expect(mocks.entry.findMany).not.toHaveBeenCalled()
  })

  it('does not let many historical matches for one code hide later codes in a batch', async () => {
    mocks.entry.groupBy.mockResolvedValue([
      { code: 'A', _count: { _all: 100 } },
      { code: 'B', _count: { _all: 1 } },
    ])
    mocks.entry.findMany.mockResolvedValue([{ ...row, code: 'B', id: 'entry-B' }])

    const result = await resolveLookupEntriesByCodes('example', ['A', 'B'], { asOf: '2024-01-01' })

    expect(result.get('A')).toMatchObject({ status: 'ambiguous', candidates: 100 })
    expect(result.get('B')).toMatchObject({ status: 'resolved', entry: { code: 'B', id: 'entry-B' } })
  })

  it('uses the new revision after any published entry changes', async () => {
    mocks.entry.findMany.mockResolvedValue([row])
    const first = await resolveLookupEntry('example', 'X', { asOf: '2026-10-25' })
    mocks.table.findMany.mockResolvedValue([{ ...table, publishedRevision: 5 }])
    mocks.entry.findMany.mockResolvedValue([])
    const next = await resolveLookupEntry('example', 'X', { asOf: '2026-10-25' })
    expect(first.status).toBe('resolved')
    expect(next.status).toBe('absent')
    expect(mocks.entry.findMany).toHaveBeenCalledTimes(2)
  })

  it('does not cache technical failures as missing codes', async () => {
    mocks.entry.findMany.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce([row])
    await expect(resolveLookupEntry('example', 'X', { asOf: '2026-10-25' })).rejects.toThrow('database unavailable')
    expect((await resolveLookupEntry('example', 'X', { asOf: '2026-10-25' })).status).toBe('resolved')
    expect(mocks.entry.findMany).toHaveBeenCalledTimes(2)
  })
})
