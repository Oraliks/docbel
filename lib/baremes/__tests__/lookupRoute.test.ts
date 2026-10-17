import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ active: vi.fn() }))

vi.mock('@/lib/baremes/getActiveBaremeData', () => ({
  getActiveBaremeData: mocks.active,
}))

import { GET } from '@/app/api/baremes/lookup/route'

const data = {
  fileId: 'published-onem',
  fileName: 'barema.xlsx',
  validFrom: new Date('2026-10-01T00:00:00.000Z'),
  publishedAt: new Date('2026-10-02T00:00:00.000Z'),
  multiplicateur: null,
  amountsByCategory: {},
  allAmounts: [
    {
      id: 'a1', sourceSheet: 'A_N_B', category: 'full_unemployment', allocationCode: 'AA1', salaryCode: 'MIN', article: null,
      labelFr: null, labelNl: null, unit: 'daily', amount: 76.55, minDailySalary: null, maxDailySalary: null,
      validFrom: new Date('2026-10-01T00:00:00.000Z'), comparisonKey: 'full_unemployment:AA1:MIN', rate: null,
    },
  ],
}

describe('GET /api/baremes/lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.active.mockResolvedValue(data)
  })

  it('lit une version fraîche et produit un ETag propre à la représentation filtrée', async () => {
    const full = await GET(new NextRequest('https://example.test/api/baremes/lookup'))
    const filtered = await GET(new NextRequest('https://example.test/api/baremes/lookup?category=full_unemployment'))

    expect(mocks.active).toHaveBeenNthCalledWith(1, { force: true })
    expect(mocks.active).toHaveBeenNthCalledWith(2, { force: true })
    expect(full.headers.get('etag')).not.toBe(filtered.headers.get('etag'))
    expect(full.headers.get('cache-control')).toBe('no-cache, max-age=0, must-revalidate')
  })

  it('renvoie 304 seulement pour le même filtre et la même publication', async () => {
    const first = await GET(new NextRequest('https://example.test/api/baremes/lookup?allocationCode=AA1'))
    const etag = first.headers.get('etag')
    const revalidated = await GET(new NextRequest('https://example.test/api/baremes/lookup?allocationCode=AA1', {
      headers: { 'if-none-match': etag! },
    }))
    const otherFilter = await GET(new NextRequest('https://example.test/api/baremes/lookup?salaryCode=MIN', {
      headers: { 'if-none-match': etag! },
    }))

    expect(revalidated.status).toBe(304)
    expect(otherFilter.status).toBe(200)
  })
})
