import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), resume: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/admin/readonly-guard', () => ({ ensureWriteAllowed: mocks.guard }))
vi.mock('@/lib/baremes/resumeRejectedBaremeImport', () => ({ resumeRejectedBaremeImport: mocks.resume }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: mocks.log }))

import { POST } from '@/app/api/baremes/import/[id]/resume/route'

const params = { params: Promise.resolve({ id: 'candidate' }) }
const post = (body: unknown = { reason: 'Reprise contrôlée après le rejet initial.' }) => new Request('https://docbel.test/api/baremes/import/candidate/resume', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('route admin de reprise du candidat rejeté', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@test' } })
    mocks.guard.mockResolvedValue(null)
    mocks.resume.mockResolvedValue({ status: 'resumed' })
    mocks.log.mockResolvedValue(undefined)
  })

  it('transmet la justification et l’identité admin au service restreint', async () => {
    const response = await POST(post(), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'resumed' })
    expect(mocks.resume).toHaveBeenCalledWith('candidate', 'admin@test', 'Reprise contrôlée après le rejet initial.')
    expect(mocks.log).toHaveBeenCalledOnce()
  })

  it('refuse un appel direct non authentifié', async () => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) })
    expect((await POST(post(), params)).status).toBe(403)
    expect(mocks.guard).not.toHaveBeenCalled()
    expect(mocks.resume).not.toHaveBeenCalled()
  })

  it('refuse une session lecture seule avant toute mutation', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({ error: 'readonly' }, { status: 403 }))
    expect((await POST(post(), params)).status).toBe(403)
    expect(mocks.resume).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('exige une justification exploitable et laisse le statut rejeté intact', async () => {
    const response = await POST(post({ reason: 'non' }), params)
    expect(response.status).toBe(400)
    expect(mocks.resume).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('renvoie un conflit si le service constate un autre statut', async () => {
    mocks.resume.mockResolvedValue({ status: 'error', reason: 'not_rejected', message: 'Statut incompatible.' })
    const response = await POST(post(), params)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: 'Statut incompatible.', code: 'not_rejected' })
    expect(mocks.log).not.toHaveBeenCalled()
  })
})
