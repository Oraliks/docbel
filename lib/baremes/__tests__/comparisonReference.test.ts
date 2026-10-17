import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ file: vi.fn(), published: vi.fn(), amounts: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file, findFirst: mocks.published }, baremeAmount: { findMany: mocks.amounts } }, withDbRetry: <T>(fn: () => T) => fn() }))
import { compareBaremeVersions } from '../compareBaremeVersions'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.file.mockResolvedValue({ id: 'C', fileType: 'test', name: 'C', status: 'draft', validFrom: new Date('2026-01-01') })
  mocks.published.mockResolvedValue({ id: 'B', fileType: 'test', name: 'B', status: 'published', validFrom: new Date('2025-01-01') })
  mocks.amounts.mockResolvedValue([])
})
describe('référence mémorisée contre sélection explicite', () => {
  it('préserve le premier import historique même si un autre publié est apparu', async () => {
    const diff = await compareBaremeVersions('C', null)
    expect(diff.state).toBe('first_import'); expect(diff.reference).toBeNull()
    expect(mocks.published).not.toHaveBeenCalled()
  })
  it('sélectionne le publié applicable seulement en mode renouvellement', async () => {
    const diff = await compareBaremeVersions('C')
    expect(diff.reference?.id).toBe('B')
    expect(mocks.published).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ validFrom: { lte: new Date('2026-01-01') } }) }))
  })
})
