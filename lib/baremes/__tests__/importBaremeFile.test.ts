import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  createSheets: vi.fn(),
  createAmounts: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  saveBlob: vi.fn(),
  deleteBlob: vi.fn(),
  parse: vi.fn(),
  normalize: vi.fn(),
  loadMappings: vi.fn(),
  roundTrip: vi.fn(),
  contracts: vi.fn(),
  coverage: vi.fn(),
  invariants: vi.fn(),
  compare: vi.fn(),
  anomalies: vi.fn(),
  log: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    baremeFile: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    $transaction: mocks.transaction,
  },
  withDbRetry: (fn: () => unknown) => fn(),
}))
vi.mock('@/lib/storage/blob-storage', () => ({
  saveBlob: mocks.saveBlob,
  deleteBlob: mocks.deleteBlob,
}))
vi.mock('@/lib/baremes-parser', () => ({ parseBaremaFile: mocks.parse }))
vi.mock('../normalizeBaremeData', () => ({ normalizeBaremeData: mocks.normalize }))
vi.mock('../loadSheetMappings', () => ({ loadSheetMappingOverrides: mocks.loadMappings }))
vi.mock('../verifyRoundTrip', () => ({ verifyRoundTrip: mocks.roundTrip }))
vi.mock('../sheetContracts', () => ({ verifySheetContracts: mocks.contracts }))
vi.mock('../verifyCoverage', () => ({ verifyCoverage: mocks.coverage }))
vi.mock('../verifyInvariants', () => ({ verifyInvariants: mocks.invariants }))
vi.mock('../compareBaremeVersions', () => ({
  compareBaremeVersions: mocks.compare,
  detectAnomaliesFromDiff: mocks.anomalies,
  comparisonSnapshot: (diff: { state: string; candidate: unknown; reference: unknown }) => ({ version: 1, state: diff.state, candidate: diff.candidate, reference: diff.reference, computedAt: '2026-01-01T00:00:00.000Z' }),
}))
vi.mock('../publicationLog', () => ({ logPublicationEvent: mocks.log }))

import { importBaremeFile } from '../importBaremeFile'

const sourceBytes = Buffer.from('xlsx-fixture-bytes')
const storedPath = 'blobs:https://fixture.private.blob.vercel-storage.com/private/baremes/file.xlsx'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findUnique.mockResolvedValue(null)
  mocks.saveBlob.mockResolvedValue(storedPath)
  mocks.deleteBlob.mockResolvedValue(undefined)
  mocks.parse.mockReturnValue({
    fileMetadata: { effectiveDate: '1-4-2026' },
    sheets: [],
  })
  mocks.loadMappings.mockResolvedValue({})
  mocks.normalize.mockReturnValue({
    amounts: [],
    alerts: [],
    summary: {
      sheetsDetected: 0,
      sheetsParsed: 0,
      sheetsIgnored: 0,
      sheetsByName: [],
      amountsExtracted: 0,
    },
    validFrom: new Date('2026-04-01T00:00:00.000Z'),
    diagnostics: {
      unknownCodes: [],
      ignoredRows: [],
      unsupportedSheets: [],
      partialSheets: [],
      sheetPeriods: [],
      duplicates: [],
    },
  })
  mocks.roundTrip.mockReturnValue({ alerts: [], checked: 0, direct: 0, derived: 0, noTrace: 0, mismatches: 0 })
  mocks.contracts.mockReturnValue({ alerts: [], results: [] })
  mocks.coverage.mockReturnValue({ alerts: [], results: [] })
  mocks.invariants.mockReturnValue({ alerts: [] })
  mocks.create.mockResolvedValue({ id: 'bareme-new' })
  mocks.createSheets.mockResolvedValue({ count: 0 })
  mocks.createAmounts.mockResolvedValue({ count: 0 })
  mocks.update.mockResolvedValue(undefined)
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      baremeFile: { create: mocks.create },
      bareSheet: { createMany: mocks.createSheets },
      baremeAmount: { createMany: mocks.createAmounts },
    })
  )
  mocks.compare.mockResolvedValue({
    countsByType: { added: 0, modified: 0, disappeared: 0, unchanged: 0, ambiguous: 0 },
    state: 'first_import',
    candidate: { id: 'bareme-new', name: 'candidate', status: 'draft', fileType: 'onem-rates', validFrom: '2026-04-01T00:00:00.000Z', dataRevision: 'new' },
    reference: null,
  })
  mocks.anomalies.mockReturnValue([])
  mocks.log.mockResolvedValue(undefined)
})

describe('importBaremeFile — conservation de la source', () => {
  it('conserve le xlsx exact dans le Blob privé avant de créer le draft', async () => {
    const result = await importBaremeFile({
      buffer: sourceBytes,
      fileName: 'barema-new-01042026.xlsx',
      createdBy: 'admin@example.test',
    })

    expect(result).toMatchObject({ status: 'created', fileId: 'bareme-new' })
    expect(mocks.saveBlob).toHaveBeenCalledWith(
      sourceBytes,
      expect.stringMatching(/^private\/baremes\/[a-f0-9]{64}-barema-new-01042026\.xlsx$/),
      true
    )
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        filePath: storedPath,
        fileSize: sourceBytes.byteLength,
      }),
    }))
  })

  it('échoue sans créer de draft si le stockage privé est indisponible', async () => {
    mocks.saveBlob.mockRejectedValueOnce(new Error('Missing private Blob store configuration'))

    await expect(importBaremeFile({ buffer: sourceBytes, fileName: 'barema-new-01042026.xlsx' }))
      .rejects.toThrow('Conservation durable du fichier source impossible')

    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.deleteBlob).not.toHaveBeenCalled()
  })

  it('nettoie seulement le Blob créé si la transaction DB échoue', async () => {
    mocks.transaction.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(importBaremeFile({ buffer: sourceBytes, fileName: 'barema-new-01042026.xlsx' }))
      .rejects.toThrow('database unavailable')

    expect(mocks.deleteBlob).toHaveBeenCalledWith(storedPath)
  })
})
