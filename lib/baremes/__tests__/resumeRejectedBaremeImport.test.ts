import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { dataRevisionFromAmounts } from '../compareBaremeVersions'
import { canResumeComparison, readSnapshot } from '../comparisonReview'

const mocks = vi.hoisted(() => ({
  file: vi.fn(), current: vi.fn(), transaction: vi.fn(), publication: vi.fn(),
  decisionCount: vi.fn(), approvalCount: vi.fn(), amounts: vi.fn(), approvals: vi.fn(), deleteApprovals: vi.fn(),
  update: vi.fn(), blob: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { baremeFile: { findUnique: mocks.file }, $transaction: mocks.transaction },
  withDbRetry: <T>(fn: () => T) => fn(),
}))
vi.mock('@/lib/storage/blob-storage', () => ({
  getBlob: mocks.blob,
  isPrivateBlobPath: (path: string) => path.startsWith('blobs:https://fixture.private.'),
}))
import { resumeRejectedBaremeImport } from '../resumeRejectedBaremeImport'

const bytes = Buffer.from('source workbook')
const hash = createHash('sha256').update(bytes).digest('hex')
const revision = dataRevisionFromAmounts([])
const snapshot = { version: 1 as const, state: 'computed' as const,
  candidate: { id: 'candidate', name: 'rates.xlsx', status: 'published', fileType: 'onem-rates', validFrom: '2026-09-01', dataRevision: revision },
  reference: { id: 'reference', name: 'reference.xlsx', status: 'published', fileType: 'onem-rates', validFrom: '2026-04-01', dataRevision: revision },
  computedAt: '2026-10-01T00:00:00.000Z' }
const file = {
  id: 'candidate', status: 'rejected', fileType: 'onem-rates', fileHash: hash, fileSize: bytes.length,
  filePath: 'blobs:https://fixture.private.blob.vercel-storage.com/candidate', publishedAt: null,
  diagnostics: { comparison: snapshot, comparisonAlerts: [{ kind: 'anomaly' }], structuralAlerts: [{ kind: 'unknown_code' }], unsupportedSheets: ['legacy'] },
  alerts: [{ kind: 'anomaly', problem: { resolutionState: 'confirmed' } }, { kind: 'unknown_code' }],
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.file.mockResolvedValue(file)
  mocks.current.mockResolvedValue(file)
  mocks.blob.mockResolvedValue(bytes)
  mocks.amounts.mockResolvedValue([])
  mocks.approvals.mockResolvedValue([{ id: 'approval-1', approverEmail: 'admin@example.test', approverName: 'Admin', comment: 'ancienne version', createdAt: new Date('2026-10-01T00:00:00.000Z') }])
  mocks.decisionCount.mockResolvedValue(2)
  mocks.approvalCount.mockResolvedValue(1)
  mocks.update.mockResolvedValue({ count: 1 })
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({
    baremeFile: { findUnique: mocks.current, updateMany: mocks.update },
    baremePublicationLog: { findFirst: mocks.publication, count: mocks.decisionCount, create: mocks.publication },
    baremeAmount: { findMany: mocks.amounts },
    baremeApproval: { count: mocks.approvalCount, findMany: mocks.approvals, deleteMany: mocks.deleteApprovals },
  }))
})

describe('reprise contrôlée d’un import rejeté', () => {
  it('revient en brouillon après preuve de la source, en gardant l’historique et en invalidant les décisions passées', async () => {
    mocks.publication.mockResolvedValue(null)
    const result = await resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Reprise demandée après correction du rejet initial.')
    expect(result).toEqual({ status: 'resumed' })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'candidate', status: 'rejected', fileHash: hash }),
      data: expect.objectContaining({ status: 'draft', diagnostics: expect.objectContaining({
        structuralAlerts: [{ kind: 'unknown_code' }], unsupportedSheets: ['legacy'],
        comparisonPending: { version: 1, fileHash: hash, fileSize: bytes.length }, comparisonAlerts: [],
      }), alerts: [{ kind: 'unknown_code' }] }),
    }))
    const resumedData = mocks.update.mock.calls[0][0].data
    expect(Object.keys(resumedData).sort()).toEqual(['alerts', 'diagnostics', 'status'])
    expect(readSnapshot(resumedData.diagnostics)).toBeNull()
    expect(canResumeComparison({ ...file, status: 'draft', diagnostics: resumedData.diagnostics })).toBe(true)
    expect(mocks.deleteApprovals).toHaveBeenCalledWith({ where: { fileId: 'candidate' } })
    expect(mocks.publication).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      action: 'resumed', fromStatus: 'rejected', toStatus: 'draft', actorEmail: 'admin@example.test',
      details: expect.objectContaining({ reason: expect.stringContaining('Reprise demandée'), invalidatedReviewOrConfirmationCount: 2,
        previousAlerts: file.alerts,
        invalidatedApprovals: [expect.objectContaining({ approverEmail: 'admin@example.test' })] }),
    }) }))
    expect(mocks.amounts).toHaveBeenCalled()
  })

  it.each(['draft', 'published', 'archived'])(`refuse le statut %s`, async (status) => {
    mocks.file.mockResolvedValue({ ...file, status })
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'not_rejected' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each(['missing', 'wrong-hash'] as const)('refuse une source %s sans transition', async (condition) => {
    if (condition === 'missing') mocks.blob.mockResolvedValue(null)
    else mocks.blob.mockResolvedValue(Buffer.from('other bytes'))
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'unavailable' })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refuse un import qui a déjà été publié et conserve son statut', async () => {
    mocks.publication.mockResolvedValue({ id: 'published-event' })
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'not_rejected' })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.deleteApprovals).not.toHaveBeenCalled()
  })

  it('refuse un second clic dès que le statut a quitté rejected', async () => {
    mocks.current.mockResolvedValue({ ...file, status: 'draft' })
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'not_rejected' })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.deleteApprovals).not.toHaveBeenCalled()
  })

  it('refuse une révision normalisée modifiée ou une course transactionnelle', async () => {
    mocks.amounts.mockResolvedValue([{ id: 'changed', sourceSheet: 'A', category: 'full_unemployment', allocationCode: 'AA1', salaryCode: null,
      article: null, labelFr: 'changed', labelNl: null, unit: 'daily', amount: { toNumber: () => 50 }, minDailySalary: null,
      maxDailySalary: null, comparisonKey: 'changed', rawData: {} }])
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'changed' })
    expect(mocks.update).not.toHaveBeenCalled()

    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Write conflict', { code: 'P2034', clientVersion: '5.22' }))
    await expect(resumeRejectedBaremeImport('candidate', 'admin@example.test', 'Justification suffisamment longue pour tester.'))
      .resolves.toMatchObject({ status: 'error', reason: 'changed' })
  })
})
