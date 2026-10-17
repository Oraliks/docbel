import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { comparisonFilterParams } from '@/lib/baremes/comparisonFilters'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), file: vi.fn(), published: vi.fn(), compare: vi.fn(), review: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/admin/readonly-guard', () => ({ ensureWriteAllowed: mocks.guard }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file, findFirst: mocks.published } }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('@/lib/baremes/compareBaremeVersions', () => ({ compareBaremeVersions: mocks.compare }))
vi.mock('@/lib/baremes/comparisonReview', () => ({ readSnapshot: (d: { comparison?: unknown } | null) => d?.comparison ?? null, recordBaremeComparisonReview: mocks.review, refreshBaremeComparison: mocks.refresh }))
import { GET, POST as refresh } from '@/app/api/baremes/import/[id]/comparison/route'
import { POST as review } from '@/app/api/baremes/import/[id]/review/route'
import { GET as exportComparison } from '@/app/api/baremes/import/[id]/export/route'
const params = () => ({ params: Promise.resolve({ id: 'C' }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@test' } })
  mocks.guard.mockResolvedValue(null)
  mocks.file.mockResolvedValue({ id: 'C', fileType: 'test', name: 'C.xlsx', status: 'draft', validFrom: new Date('2026-01-01'), alerts: [], diagnostics: { comparison: { version: 1, state: 'first_import', candidate: { id: 'C', dataRevision: 'C-data' }, reference: null } } })
  mocks.published.mockResolvedValue(null)
  mocks.compare.mockResolvedValue({ changes: [], candidateDataRevision: 'C-data', referenceDataRevision: null, countsByType: {}, countsByChange: {} })
})
describe('routes de comparaison Barèmes', () => {
  it('sert le premier import comme prêt, en conservant une référence explicitement absente', async () => {
    const response = await GET(new NextRequest('https://docbel.test/comparison'), params())
    expect(response.status).toBe(200)
    expect((await response.json()).state).toBe('ready')
    expect(mocks.compare).toHaveBeenCalledWith('C', null)
  })
  it.each([review, refresh])('refuse une session lecture seule avant toute mutation', async (handler) => {
    mocks.guard.mockResolvedValue(NextResponse.json({ error: 'readonly' }, { status: 403 }))
    expect((await handler(new Request('https://docbel.test', { method: 'POST' }), params())).status).toBe(403)
    expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled()
  })
  it.each([review, refresh])('refuse un anonyme avant la vérification de lecture seule', async (handler) => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: NextResponse.json({ error: 'anonymous' }, { status: 401 }) })
    expect((await handler(new Request('https://docbel.test', { method: 'POST' }), params())).status).toBe(401)
    expect(mocks.guard).not.toHaveBeenCalled()
  })
  it('renouvelle explicitement la comparaison avec l’identité authentifiée', async () => {
    mocks.refresh.mockResolvedValue({ status: 'refreshed', snapshot: {} })
    expect((await refresh(new Request('https://docbel.test', { method: 'POST' }), params())).status).toBe(200)
    expect(mocks.refresh).toHaveBeenCalledWith('C', 'admin@test')
  })
  it('exporte le même sous-ensemble feuille/catégorie que le tableau', async () => {
    const row = (key: string, sourceSheet: string, category: string) => ({ type: 'added', key, newValue: 1, sourceSheet, category, current: { sourceSheet, category, amount: 1, unit: 'daily', trace: null } })
    mocks.compare.mockResolvedValue({ changes: [row('included', 'F1', 'basic'), row('wrong-sheet', 'F2', 'basic'), row('wrong-category', 'F1', 'other')] })
    const query = comparisonFilterParams({ sheet: 'F1', category: 'basic' }); query.set('scope', 'filtered'); query.set('type', 'comparison')
    const response = await exportComparison(new NextRequest(`https://docbel.test/export?${query}`), params())
    expect(response.status).toBe(200)
    const csv = await response.text()
    expect(csv).toContain('included'); expect(csv).not.toContain('wrong-sheet'); expect(csv).not.toContain('wrong-category')
  })
})
