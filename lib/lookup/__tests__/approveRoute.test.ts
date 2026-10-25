import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  requireAdminAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.requireAdminAuth }))

import { POST } from '../../../app/api/lookup/tables/[id]/approve/route'

function request(body: string) {
  return new NextRequest('http://localhost/api/lookup/tables/table-1/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('Lookup proposal approval request validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminAuth.mockResolvedValue({
      isAuthorized: true,
      user: { id: 'admin-1', name: 'Admin', email: 'admin@example.test', isAdmin: true },
    })
  })

  it('returns 400 for an invalid proposal payload without starting a transaction', async () => {
    const response = await POST(request('{"proposalId":""}'), { params: Promise.resolve({ id: 'table-1' }) })

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON without starting a transaction', async () => {
    const response = await POST(request('{broken'), { params: Promise.resolve({ id: 'table-1' }) })

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
