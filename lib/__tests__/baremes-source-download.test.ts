import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  getBlob: vi.fn(),
  isBlobsPath: vi.fn(),
  readFile: vi.fn(),
}))

vi.mock('@/lib/auth-check', () => ({ requireAdminAuth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { baremeFile: { findUnique: mocks.findUnique } },
  withDbRetry: (fn: () => unknown) => fn(),
}))
vi.mock('@/lib/storage/blob-storage', () => ({
  getBlob: mocks.getBlob,
  isBlobsPath: mocks.isBlobsPath,
}))
vi.mock('fs/promises', () => ({ readFile: mocks.readFile }))

import { GET } from '@/app/api/baremes/import/[id]/source/route'

const original = Buffer.from('exact-xlsx-fixture-bytes')
const originalHash = createHash('sha256').update(original).digest('hex')

function download() {
  return GET(new NextRequest('https://docbel.example.test/api/baremes/import/bareme-1/source'), {
    params: Promise.resolve({ id: 'bareme-1' }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ isAuthorized: true, user: { id: 'admin-1' } })
  mocks.isBlobsPath.mockReturnValue(true)
  mocks.getBlob.mockResolvedValue(original)
  mocks.findUnique.mockResolvedValue({
    name: 'barema-new-01042026.xlsx',
    filePath: 'blobs:https://fixture.private.blob.vercel-storage.com/private/baremes/file.xlsx',
    fileHash: originalHash,
    fileSize: original.byteLength,
  })
})

describe('téléchargement de la source barèmes', () => {
  it('exige l’autorisation admin avant toute lecture de la provenance', async () => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: new Response(null, { status: 403 }) })

    expect((await download()).status).toBe(403)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })

  it('restitue exactement les octets du Blob privé vérifié', async () => {
    const response = await download()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet')
    expect(response.headers.get('content-disposition')).toContain('barema-new-01042026.xlsx')
    expect(Buffer.from(await response.arrayBuffer())).toEqual(original)
    expect(mocks.getBlob).toHaveBeenCalledWith(expect.stringContaining('private/baremes/file.xlsx'))
  })

  it('refuse de servir un original dont hash ou taille ne concordent plus', async () => {
    mocks.getBlob.mockResolvedValueOnce(Buffer.from('different-bytes'))

    const response = await download()

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Intégrité du fichier source non vérifiée' })
  })

  it('préserve le repli local pour les imports legacy', async () => {
    mocks.isBlobsPath.mockReturnValue(false)
    mocks.findUnique.mockResolvedValue({
      name: 'legacy.xlsx',
      filePath: 'private/uploads/baremes/legacy.xlsx',
      fileHash: null,
      fileSize: null,
    })
    mocks.readFile.mockResolvedValue(original)

    const response = await download()

    expect(response.status).toBe(200)
    expect(Buffer.from(await response.arrayBuffer())).toEqual(original)
    expect(mocks.readFile).toHaveBeenCalledOnce()
  })

  it('annonce honnêtement l’absence de l’original', async () => {
    mocks.getBlob.mockResolvedValueOnce(null)

    const response = await download()

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Fichier source original indisponible' })
  })

  it('n’essaie pas de récupérer un Blob si l’import ne référence aucune source', async () => {
    mocks.findUnique.mockResolvedValue({ name: 'missing-source', filePath: null, fileHash: null, fileSize: null })

    const response = await download()

    expect(response.status).toBe(404)
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })
})
