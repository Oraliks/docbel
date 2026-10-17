import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}))

vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { baremeFile: { findMany: mocks.findMany, count: mocks.count } },
}))

import { GET } from '@/app/api/baremes/route'

describe('liste admin des barèmes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { id: 'admin-fixture' } })
    mocks.count.mockResolvedValue(2)
    mocks.findMany.mockResolvedValue([
      {
        id: 'newest', name: 'barème-avril.xlsx', effectiveDate: '', validFrom: null,
        uploadedAt: new Date('2026-04-01'), publishedAt: null, multiplicateur: null,
        status: 'draft', fileHash: 'hash', _count: { sheets: 2, amounts: 4 },
      },
      {
        id: 'older', name: 'barème-mars.xlsx', effectiveDate: '', validFrom: null,
        uploadedAt: new Date('2026-03-01'), publishedAt: null, multiplicateur: null,
        status: 'archived', fileHash: null, _count: { sheets: 2, amounts: 4 },
      },
    ])
  })

  it('borne la page et émet un curseur sans tronquer silencieusement', async () => {
    const response = await GET(new NextRequest('https://docbel.test/api/baremes?limit=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(2)
    expect(body.hasMore).toBe(true)
    expect(body.nextCursor).toBe('newest')
    expect(body.files).toHaveLength(1)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2,
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    }))
  })

  it('applique recherche et statut dans la requête DB', async () => {
    await GET(new NextRequest('https://docbel.test/api/baremes?status=draft&search=avril&cursor=older'))

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: 'older' },
      skip: 1,
      where: {
        status: { in: ['draft'] },
        name: { contains: 'avril', mode: 'insensitive' },
      },
    }))
  })

  it('refuse avant toute requête DB un appel non autorisé', async () => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: new Response(null, { status: 403 }) })

    expect((await GET(new NextRequest('https://docbel.test/api/baremes'))).status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
