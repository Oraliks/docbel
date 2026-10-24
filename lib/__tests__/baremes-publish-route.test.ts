import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), publish: vi.fn(), log: vi.fn() }))

vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/admin/readonly-guard', () => ({ ensureWriteAllowed: mocks.guard }))
vi.mock('@/lib/baremes/publishBaremeImport', () => ({ publishBaremeImport: mocks.publish }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: mocks.log }))

import { POST } from '@/app/api/baremes/import/[id]/publish/route'

const params = { params: Promise.resolve({ id: 'draft-1' }) }
const post = (body: unknown = {}) => new Request('https://docbel.test/api/baremes/import/draft-1/publish', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('route de publication admin des barèmes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@test' } })
    mocks.guard.mockResolvedValue(null)
    mocks.publish.mockResolvedValue({ status: 'published', fileId: 'draft-1', archivedPreviousId: 'published-0' })
    mocks.log.mockResolvedValue(undefined)
  })

  it('publie uniquement après le contrôle serveur, avec l’identité authentifiée', async () => {
    const response = await POST(post(), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'published', fileId: 'draft-1', archivedPreviousId: 'published-0' })
    expect(mocks.publish).toHaveBeenCalledWith('draft-1', { publishedBy: 'admin@test', force: false })
    expect(mocks.log).toHaveBeenCalledOnce()
  })

  it('refuse un appel direct non autorisé avant le service de publication', async () => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) })

    expect((await POST(post(), params)).status).toBe(403)
    expect(mocks.guard).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })

  it('refuse une session en lecture seule avant toute publication', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({ error: 'readonly' }, { status: 403 }))

    expect((await POST(post(), params)).status).toBe(403)
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('reflète un blocage structurel du serveur et ne journalise pas une publication', async () => {
    mocks.publish.mockResolvedValue({ status: 'error', reason: 'has_errors', message: 'Lecture invalide' })

    const response = await POST(post({ force: true }), params)

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'Lecture invalide', reason: 'has_errors' })
    expect(mocks.publish).toHaveBeenCalledWith('draft-1', { publishedBy: 'admin@test', force: true })
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('expose la revue périmée comme refus serveur sans tentative de publication', async () => {
    mocks.publish.mockResolvedValue({ status: 'error', reason: 'comparison_not_reviewed', message: 'La comparaison doit être revue.' })

    const response = await POST(post(), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ reason: 'comparison_not_reviewed' })
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('rejette un corps mal formé avant le service', async () => {
    const response = await POST(post({ force: 'yes' }), params)

    expect(response.status).toBe(400)
    expect(mocks.publish).not.toHaveBeenCalled()
  })
})
