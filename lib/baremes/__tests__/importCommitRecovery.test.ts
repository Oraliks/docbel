import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'

const mocks = vi.hoisted(() => ({ find: vi.fn(), reference: vi.fn(), transaction: vi.fn(), disconnect: vi.fn(), save: vi.fn(), remove: vi.fn() }))
vi.mock('@/lib/prisma', async (importOriginal) => {
  // Le vrai retry est indispensable à cette régression (accusé perdu puis P2002).
  const original = await importOriginal<typeof import('@/lib/prisma')>()
  vi.spyOn(original.prisma, '$disconnect').mockImplementation(mocks.disconnect)
  return { ...original, prisma: { baremeFile: { findUnique: mocks.find, findFirst: mocks.reference }, $transaction: mocks.transaction } }
})
vi.mock('@/lib/storage/blob-storage', () => ({ saveBlob: mocks.save, deleteBlob: mocks.remove }))
vi.mock('@/lib/baremes-parser', () => ({ parseBaremaFile: () => ({ fileMetadata: {}, sheets: [] }) }))
vi.mock('../normalizeBaremeData', () => ({ normalizeBaremeData: () => ({ amounts: [], alerts: [], summary: {}, validFrom: new Date('2026-01-01'), diagnostics: { unknownCodes: [], ignoredRows: [] } }) }))
vi.mock('../loadSheetMappings', () => ({ loadSheetMappingOverrides: async () => ({}) }))
vi.mock('../verifyRoundTrip', () => ({ verifyRoundTrip: () => ({ alerts: [] }) }))
vi.mock('../sheetContracts', () => ({ verifySheetContracts: () => ({ alerts: [], results: [] }) }))
vi.mock('../verifyCoverage', () => ({ verifyCoverage: () => ({ alerts: [] }) }))
vi.mock('../verifyInvariants', () => ({ verifyInvariants: () => ({ alerts: [] }) }))
import { importBaremeFile } from '../importBaremeFile'

const bytes = Buffer.from('committed source')
const path = 'blobs:https://fixture.private.blob.vercel-storage.com/committed.xlsx'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.find.mockResolvedValue(null)
  mocks.save.mockResolvedValue(path)
})
describe('commit d’import avec accusé perdu et vrai withDbRetry', () => {
  it('récupère la fiche confirmée sans supprimer sa source après le P2002 du retry', async () => {
    let committed = false
    mocks.transaction.mockImplementation(async () => {
      if (!committed) { committed = true; throw new Error('connection closed after COMMIT') }
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22' })
    })
    mocks.reference.mockImplementation(async () => committed ? { id: 'persisted', fileHash: createHash('sha256').update(bytes).digest('hex'), fileSize: bytes.length, name: 'C.xlsx' } : null)
    await expect(importBaremeFile({ buffer: bytes, fileName: 'C.xlsx' })).resolves.toMatchObject({ status: 'duplicate', fileId: 'persisted' })
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('préserve la source si le retry termine par P2002 mais la réconciliation ne retrouve pas le commit', async () => {
    mocks.transaction
      .mockRejectedValueOnce(new Error('connection closed after COMMIT'))
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22' }))
    mocks.reference.mockResolvedValue(null)
    await expect(importBaremeFile({ buffer: bytes, fileName: 'C.xlsx' })).rejects.toMatchObject({ code: 'P2002' })
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('préserve la source lorsque la lecture de réconciliation échoue après commit', async () => {
    mocks.transaction
      .mockRejectedValueOnce(new Error('connection closed after COMMIT'))
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22' }))
    mocks.reference.mockRejectedValue(new Error('reconciliation refused'))
    await expect(importBaremeFile({ buffer: bytes, fileName: 'C.xlsx' })).rejects.toMatchObject({ code: 'P2002' })
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
