import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), confirm: vi.fn() }))
vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/admin/readonly-guard', () => ({ ensureWriteAllowed: mocks.guard }))
vi.mock('@/lib/baremes/changeConfirmation', () => ({ confirmBaremeChange: mocks.confirm }))

import { POST } from '@/app/api/baremes/import/[id]/confirm/route'

const comparison = {
  version: 1,
  state: 'computed',
  computedAt: '2026-04-01T12:00:00.000Z',
  candidate: { id: 'C', name: 'candidate.xlsx', status: 'draft', fileType: 'test', validFrom: '2026-04-01T00:00:00.000Z', dataRevision: 'revision-C' },
  reference: { id: 'A', name: 'reference.xlsx', status: 'published', fileType: 'test', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'revision-A' },
}
const body = (overrides: Record<string, unknown> = {}) => ({ problemId: 'anomaly-1', reason: 'Contrôle des deux cellules et confirmation du changement réel.', comparison, ...overrides })
const request = (value: unknown = body()) => new Request('https://docbel.test/api/baremes/import/C/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
})
const params = { params: Promise.resolve({ id: 'C' }) }

describe('route de confirmation des variations de barème', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@test' } })
    mocks.guard.mockResolvedValue(null)
    mocks.confirm.mockResolvedValue({ status: 'confirmed', problemId: 'anomaly-1', confirmedKeys: ['basic:A'] })
  })

  it('transmet au service les données strictes et l’identité issue de la session', async () => {
    const response = await POST(request(), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'confirmed', problemId: 'anomaly-1', confirmedKeys: ['basic:A'] })
    expect(mocks.confirm).toHaveBeenCalledWith('C', 'admin@test', { problemId: 'anomaly-1', reason: body().reason, comparison })
  })

  it('refuse une session non autorisée avant la garde et le service', async () => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: new Response('forbidden', { status: 403 }) })

    expect((await POST(request(), params)).status).toBe(403)
    expect(mocks.guard).not.toHaveBeenCalled()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('refuse une session en lecture seule sans appeler le service', async () => {
    mocks.guard.mockResolvedValue(new Response('readonly', { status: 403 }))

    expect((await POST(request(), params)).status).toBe(403)
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it.each([
    { problemId: 'bad', reason: 'trop court', comparison },
    { ...body(), extra: true },
    { ...body(), comparison: { ...comparison, state: 'first_import' } },
  ])('rejette un corps incomplet, trop court ou non strict avant le service', async (invalid) => {
    expect((await POST(request(invalid), params)).status).toBe(400)
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('renvoie un conflit si le groupe a déjà été confirmé par un autre POST', async () => {
    mocks.confirm
      .mockResolvedValueOnce({ status: 'confirmed', problemId: 'anomaly-1', confirmedKeys: ['basic:A'] })
      .mockResolvedValueOnce({ status: 'error', reason: 'not_actionable', message: 'Ce constat ne peut plus être confirmé.' })

    const responses = await Promise.all([POST(request(), params), POST(request(), params)])

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    expect(mocks.confirm).toHaveBeenCalledTimes(2)
  })
})
