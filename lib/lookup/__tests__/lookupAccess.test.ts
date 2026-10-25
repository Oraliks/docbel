import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUser } },
  withDbRetry: (callback: () => unknown) => callback(),
}))

import { requirePartnerOrAdminAuth } from '@/lib/auth-check'

describe('Lookup partner/admin access guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('denies visitors without querying user data', async () => {
    mocks.getSession.mockResolvedValue(null)
    const result = await requirePartnerOrAdminAuth()
    expect(result.isAuthorized).toBe(false)
    if (!result.isAuthorized) expect(result.error.status).toBe(401)
    expect(mocks.findUser).not.toHaveBeenCalled()
  })

  it('denies an active user without the professional role', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.findUser.mockResolvedValue({ id: 'user-1', name: 'User', email: 'u@example.test', role: 'user', status: 'active', partnerOrganization: null })
    const result = await requirePartnerOrAdminAuth()
    expect(result.isAuthorized).toBe(false)
    if (!result.isAuthorized) expect(result.error.status).toBe(403)
  })

  it('allows a professional partner with an organization', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'partner-1' } })
    mocks.findUser.mockResolvedValue({ id: 'partner-1', name: 'Partner', email: 'p@example.test', role: 'partner', status: 'active', partnerOrganization: 'org-1' })
    const result = await requirePartnerOrAdminAuth()
    expect(result.isAuthorized).toBe(true)
    if (result.isAuthorized) expect(result.user.isAdmin).toBe(false)
  })

  it('allows an active administrator', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.findUser.mockResolvedValue({ id: 'admin-1', name: 'Admin', email: 'a@example.test', role: 'admin', status: 'active', partnerOrganization: null })
    const result = await requirePartnerOrAdminAuth()
    expect(result.isAuthorized).toBe(true)
    if (result.isAuthorized) expect(result.user.isAdmin).toBe(true)
  })

  it('rechecks current account status and denies an access that was revoked', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'partner-1' } })
    mocks.findUser.mockResolvedValue({ id: 'partner-1', name: 'Partner', email: 'p@example.test', role: 'partner', status: 'disabled', partnerOrganization: 'org-1' })
    const result = await requirePartnerOrAdminAuth()
    expect(result.isAuthorized).toBe(false)
    if (!result.isAuthorized) expect(result.error.status).toBe(401)
    expect(mocks.findUser).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'partner-1' } }))
  })
})
