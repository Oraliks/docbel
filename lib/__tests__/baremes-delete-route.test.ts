import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), guard: vi.fn(), file: vi.fn(), claim: vi.fn(), remove: vi.fn(), blob: vi.fn(), unlink: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/admin/readonly-guard', () => ({ ensureWriteAllowed: mocks.guard }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file, updateMany: mocks.claim, deleteMany: mocks.remove } }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('@/lib/storage/blob-storage', () => ({ isBlobsPath: (p: string) => p.startsWith('blobs:'), deleteBlob: mocks.blob }))
vi.mock('fs/promises', () => ({ unlink: mocks.unlink }))
vi.mock('@/lib/activity-logger', () => ({ logActivity: mocks.log }))
import { DELETE } from '@/app/api/baremes/[id]/route'
const source = 'blobs:https://fixture.private.blob.vercel-storage.com/source.xlsx'
const request = () => DELETE(new NextRequest('https://docbel.test/api/baremes/C', { method: 'DELETE' }), { params: Promise.resolve({ id: 'C' }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ isAuthorized: true, user: { email: 'admin@test' } })
  mocks.guard.mockResolvedValue(null)
  mocks.file.mockResolvedValue({ id: 'C', name: 'C.xlsx', status: 'draft', filePath: source })
  mocks.claim.mockResolvedValue({ count: 1 }); mocks.remove.mockResolvedValue({ count: 1 })
})
describe('suppression des sources Barèmes', () => {
  it('supprime le Blob avant la fiche, après avoir verrouillé son statut', async () => {
    expect((await request()).status).toBe(200)
    expect(mocks.blob).toHaveBeenCalledWith(source)
    expect(mocks.unlink).not.toHaveBeenCalled()
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.blob.mock.invocationCallOrder[0])
    expect(mocks.blob.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0])
  })
  it('conserve la référence et un statut non publiable si le stockage échoue', async () => {
    mocks.blob.mockRejectedValue(new Error('storage unavailable'))
    const response = await request()
    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe('source_cleanup_failed')
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'deleting' } }))
  })
  it('autorise le réessai après une panne DB survenue après suppression de source', async () => {
    mocks.remove.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce({ count: 1 })
    expect((await request()).status).toBe(500)
    mocks.file.mockResolvedValue({ id: 'C', status: 'deleting', name: 'C.xlsx', filePath: source })
    expect((await request()).status).toBe(200)
  })
  it.each(['published', 'archived'])('préserve la provenance d’une version %s', async (status) => {
    mocks.file.mockResolvedValue({ id: 'C', status, filePath: source })
    expect((await request()).status).toBe(409)
    expect(mocks.blob).not.toHaveBeenCalled()
    expect(mocks.claim).not.toHaveBeenCalled()
  })
  it('refuse une publication concurrente ayant déjà changé le statut', async () => {
    mocks.claim.mockResolvedValue({ count: 0 })
    expect((await request()).status).toBe(409)
    expect(mocks.blob).not.toHaveBeenCalled()
  })
  it('refuse un chemin legacy extérieur aux répertoires de sources', async () => {
    mocks.file.mockResolvedValue({ id: 'C', status: 'draft', filePath: '../outside.xlsx' })
    expect((await request()).status).toBe(502)
    expect(mocks.unlink).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('applique le garde lecture seule avant tout accès aux fichiers', async () => {
    mocks.guard.mockResolvedValue(NextResponse.json({ error: 'readonly' }, { status: 403 }))
    expect((await request()).status).toBe(403)
    expect(mocks.file).not.toHaveBeenCalled()
  })
})
