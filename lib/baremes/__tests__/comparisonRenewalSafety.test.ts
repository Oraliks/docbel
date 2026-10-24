import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaremeComparableAmount, BaremeDiff } from '../types'

const mocks = vi.hoisted(() => ({ file: vi.fn(), tx: vi.fn(), published: vi.fn(), update: vi.fn(), log: vi.fn(), review: vi.fn(), compare: vi.fn(), invalidate: vi.fn(), findAmounts: vi.fn(), approvals: vi.fn(), deleteApprovals: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file }, $transaction: mocks.tx }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('../compareBaremeVersions', async (original) => ({ ...await original<typeof import('../compareBaremeVersions')>(), compareBaremeVersions: mocks.compare }))
vi.mock('../getActiveBaremeData', () => ({ invalidateActiveBaremeCache: mocks.invalidate }))
vi.mock('../publicationLog', () => ({ logPublicationEvent: vi.fn() }))
import { buildBaremeDiff, comparisonSnapshot, dataRevisionFromAmounts, detectAnomaliesFromDiff } from '../compareBaremeVersions'
import { recordBaremeComparisonReview, refreshBaremeComparison } from '../comparisonReview'
import { publishBaremeImport } from '../publishBaremeImport'

const ref = (id: string) => ({ id, name: `${id}.xlsx`, status: 'published', fileType: 'test', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: `${id}-data` })
const amount = (value: number): BaremeComparableAmount => ({ id: 'row', comparisonKey: 'key', amount: value, sourceSheet: 'F', category: 'full_unemployment', allocationCode: 'key', salaryCode: null, article: null, labelFr: 'key', labelNl: null, unit: 'daily', minDailySalary: null, maxDailySalary: null, trace: null })
beforeEach(() => vi.resetAllMocks())
describe('cohérence atomique des alertes après renouvellement', () => {
  it.each([60, 150])('remplace les alertes C/A par C/B (%s) sans perdre le diagnostic structurel', async (newBase) => {
    const old: BaremeDiff = buildBaremeDiff([amount(149)], [amount(100)], ref('C'), ref('A'))
    const next = buildBaremeDiff([amount(149)], [amount(newBase)], ref('C'), ref('B'))
    next.candidateDataRevision = dataRevisionFromAmounts([amount(149)])
    next.referenceDataRevision = dataRevisionFromAmounts([amount(newBase)])
    next.candidate.dataRevision = next.candidateDataRevision
    if (next.reference) next.reference.dataRevision = next.referenceDataRevision
    const structural = { level: 'warn', kind: 'unknown_code', message: 'code structurel à vérifier' }
    // Format livré avant le marquage explicite des anomalies.
    const legacy = detectAnomaliesFromDiff(old).map(({ level, message }) => ({ level, message }))
    let file = { id: 'C', status: 'draft', fileType: 'test', validFrom: new Date('2026-01-01'), requiresApproval: false, fileHash: 'hash', fileSize: 1, filePath: 'private/source.xlsx', summary: { sheetsDetected: 12, newEntries: 99, modifiedEntries: 7 }, diagnostics: { comparison: comparisonSnapshot(old), contracts: ['structure conservée'] }, alerts: [...legacy, structural] }
    const toDb = (value: number) => ({ id: 'row', sourceSheet: 'F', category: 'full_unemployment', allocationCode: 'key', salaryCode: null, article: null, labelFr: 'key', labelNl: null, unit: 'daily', amount: { toNumber: () => value }, minDailySalary: null, maxDailySalary: null, comparisonKey: 'key', rawData: {} })
    mocks.file.mockImplementation(async () => file)
    mocks.published.mockResolvedValue({ id: 'B' })
    mocks.compare.mockImplementation(async (_id: string, reference?: string) => reference === 'A' ? old : next)
    mocks.findAmounts.mockImplementation(async ({ where }: { where: { fileId: string } }) => [toDb(where.fileId === 'C' ? 149 : newBase)])
    mocks.approvals.mockResolvedValue([{ approverEmail: 'approver@test', approverName: 'Approbateur', comment: 'ancienne version', createdAt: new Date('2026-01-01T00:00:00.000Z') }])
    mocks.update.mockImplementation(async ({ data }: { data: Partial<typeof file> }) => { file = { ...file, ...data }; return file })
    mocks.log.mockImplementation(async ({ data }: { data: { action: string; details: unknown } }) => { if (data.action === 'comparison_reviewed') mocks.review.mockResolvedValue({ details: data.details }) })
    mocks.tx.mockImplementation((fn: (tx: unknown) => unknown) => fn({ baremeFile: { findUnique: mocks.file, findFirst: mocks.published, update: mocks.update }, baremePublicationLog: { create: mocks.log, findFirst: mocks.review, findMany: vi.fn().mockResolvedValue([]) }, baremeAmount: { findMany: mocks.findAmounts }, baremeApproval: { findMany: mocks.approvals, deleteMany: mocks.deleteApprovals } }))

    const result = await refreshBaremeComparison('C', 'admin@test')
    expect(result.status).toBe('refreshed')
    expect(file.summary).toMatchObject({ sheetsDetected: 12, newEntries: 0, modifiedEntries: 1 })
    expect(file.diagnostics).toMatchObject({ contracts: ['structure conservée'], comparison: { reference: { id: 'B' } } })
    expect(file.alerts).toContainEqual(structural)
    expect(file.alerts).not.toContainEqual(legacy[0])
    expect(mocks.deleteApprovals).toHaveBeenCalledWith({ where: { fileId: 'C' } })
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'comparison_refreshed', details: expect.objectContaining({ invalidatedApprovals: [expect.objectContaining({ approverEmail: 'approver@test' })] }) }) }))
    if (result.status !== 'refreshed') throw new Error('Renouvellement attendu')
    expect((await recordBaremeComparisonReview('C', 'admin@test', result.snapshot)).status).toBe('reviewed')
    if (newBase === 60) {
      expect(file.alerts).toContainEqual(expect.objectContaining({ level: 'warn', kind: 'anomaly', problem: expect.objectContaining({ publicationEffect: 'review', allowedActions: expect.arrayContaining(['confirm_change']) }) }))
      await expect(publishBaremeImport('C')).resolves.toMatchObject({ status: 'error', reason: 'change_confirmation_required' })
      expect(mocks.invalidate).not.toHaveBeenCalled()
    } else {
      expect(file.alerts).toEqual([structural])
    }
    // Une seule écriture conserve snapshot + alertes + compteurs ensemble.
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ alerts: file.alerts, summary: file.summary, diagnostics: file.diagnostics }) }))
  })
})
