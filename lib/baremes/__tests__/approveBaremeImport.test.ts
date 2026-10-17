import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), file: vi.fn(), existing: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), log: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction }, withDbRetry: <T>(fn: () => T) => fn() }))
vi.mock('../publishBaremeImport', () => ({ publishBaremeImport: mocks.publish }))
vi.mock('../publicationLog', () => ({ logPublicationEvent: mocks.log }))
import { approveBaremeImport } from '../approveBaremeImport'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({ baremeFile: { findUnique: mocks.file, updateMany: mocks.update }, baremeApproval: { findUnique: mocks.existing, count: mocks.count, create: mocks.create } }))
  mocks.file.mockResolvedValue({ status: 'pending_approval', requiresApproval: true })
  mocks.count.mockResolvedValue(2)
})
describe('reprise de la double approbation', () => {
  it('permet au même admin de reprendre après la revue, sans troisième identité', async () => {
    mocks.existing.mockResolvedValue({ id: 'approval-B' })
    mocks.publish.mockResolvedValueOnce({ status: 'error', message: 'Revue requise' }).mockResolvedValueOnce({ status: 'published' })
    await expect(approveBaremeImport('C', { approverEmail: 'B@test' })).resolves.toMatchObject({ status: 'recorded', autoPublished: false, publicationError: 'Revue requise' })
    // La revue a ensuite été enregistrée ; la même approbation relance les gardes réelles.
    await expect(approveBaremeImport('C', { approverEmail: 'B@test' })).resolves.toMatchObject({ status: 'recorded', autoPublished: true, approvalsCount: 2 })
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
    expect(mocks.publish).toHaveBeenCalledWith('C', { publishedBy: 'B@test', bypassApprovalCheck: true })
  })
  it('ne compte jamais deux fois la première approbation', async () => {
    mocks.existing.mockResolvedValue({ id: 'approval-A' }); mocks.count.mockResolvedValue(1)
    await expect(approveBaremeImport('C', { approverEmail: 'A@test' })).resolves.toEqual({ status: 'already_approved', approvalsCount: 1 })
    expect(mocks.publish).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('conserve la seconde approbation et expose le motif du refus d’auto-publication', async () => {
    mocks.existing.mockResolvedValue(null)
    mocks.publish.mockResolvedValue({ status: 'error', message: 'Comparaison périmée' })
    await expect(approveBaremeImport('C', { approverEmail: 'B@test' })).resolves.toMatchObject({ status: 'recorded', autoPublished: false, publicationError: 'Comparaison périmée' })
    expect(mocks.create).toHaveBeenCalledOnce()
  })
})
