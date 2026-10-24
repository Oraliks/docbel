import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { BaremeComparisonSnapshot, BaremeDiff } from '../types'

const mocks = vi.hoisted(() => ({ file: vi.fn(), published: vi.fn(), compare: vi.fn(), blob: vi.fn(), update: vi.fn(), log: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file, findFirst: mocks.published }, $transaction: mocks.transaction }, withDbRetry: <T>(operation: () => T) => operation() }))
vi.mock('@prisma/client', () => ({ Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: class extends Error {} } }))
vi.mock('../compareBaremeVersions', () => ({ compareBaremeVersions: mocks.compare }))
vi.mock('../comparisonReview', () => ({ readSnapshot: (diagnostics: { comparison?: BaremeComparisonSnapshot } | null) => diagnostics?.comparison ?? null }))
vi.mock('@/lib/storage/blob-storage', () => ({ getBlob: mocks.blob, isPrivateBlobPath: (path: string) => path.startsWith('blobs:https://fixture.private.') }))

import { confirmBaremeChange } from '../changeConfirmation'

const bytes = Buffer.from('original xlsx fixture')
const hash = createHash('sha256').update(bytes).digest('hex')
const problemId = 'anomaly-group-1'
const reference = { id: 'A', name: 'référence.xlsx', status: 'published', fileType: 'test', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'revision-A' }
const candidate = { id: 'C', name: 'candidat.xlsx', status: 'draft', fileType: 'test', validFrom: '2026-04-01T00:00:00.000Z', dataRevision: 'revision-C' }
const comparison: BaremeComparisonSnapshot = { version: 1, state: 'computed', candidate, reference, computedAt: '2026-04-01T12:00:00.000Z' }
const reason = 'Contrôle des deux cellules et confirmation du changement réel.'
const makeFile = (overrides: Record<string, unknown> = {}) => ({
  id: 'C', status: 'draft', fileType: 'test', fileHash: hash, fileSize: bytes.length,
  filePath: 'blobs:https://fixture.private.example/candidate.xlsx',
  diagnostics: {
    comparison,
    comparisonAlerts: [{ level: 'warn', message: 'Variation à vérifier', problem: {
      id: problemId, groupId: problemId, category: 'anomaly', severity: 'warning', publicationEffect: 'review',
      resolutionState: 'open', affectedCount: 1, owner: 'admin', allowedActions: ['view_comparison', 'confirm_change'], affectedKeys: ['basic:A'], evidence: [],
    } }],
  },
  ...overrides,
})
const change = (overrides: Record<string, unknown> = {}) => ({
  type: 'modified', key: 'basic:A', oldValue: 10, newValue: 30, amountChanged: true,
  old: { comparisonKey: 'basic:A', sourceSheet: 'Montants', unit: 'daily', category: 'full', article: 'art. 1', minDailySalary: null, maxDailySalary: null, trace: { sourceCell: 'D13', rawValue: '10', rate: null } },
  current: { comparisonKey: 'basic:A', sourceSheet: 'Montants', unit: 'daily', category: 'full', article: 'art. 1', minDailySalary: null, maxDailySalary: null, trace: { sourceCell: 'D14', rawValue: '30', rate: null } },
  ...overrides,
})
let currentFile: { id: string; status: string; fileType: string; fileHash: string; fileSize: number; filePath: string; diagnostics: unknown }
let diff: BaremeDiff
let transactionTail: Promise<void>

function input(snapshot = comparison) { return { comparison: snapshot, problemId, reason } }
function configureTransaction() {
  mocks.transaction.mockImplementation((callback: (tx: unknown) => unknown) => {
    const run = transactionTail.then(() => callback({
      baremeFile: {
        findUnique: async () => currentFile,
        findFirst: async () => ({ id: 'A' }),
        update: async ({ data }: { data: { diagnostics: unknown } }) => { currentFile = { ...currentFile, diagnostics: data.diagnostics }; mocks.update(data); return currentFile },
      },
      baremePublicationLog: { create: mocks.log },
    }))
    transactionTail = run.then(() => undefined, () => undefined)
    return run
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  transactionTail = Promise.resolve()
  currentFile = makeFile()
  diff = { changes: [change()] as unknown as BaremeDiff['changes'], previousFileId: 'A', newFileId: 'C', state: 'computed', candidate, reference,
    candidateDataRevision: candidate.dataRevision, referenceDataRevision: reference.dataRevision,
    countsByType: { modified: 1, unchanged: 0, added: 0, disappeared: 0, ambiguous: 0 }, countsByChange: { amount: 1, attributes: 0 } }
  mocks.file.mockImplementation(async () => currentFile)
  mocks.published.mockResolvedValue({ id: 'A' })
  mocks.compare.mockImplementation(async () => diff)
  mocks.blob.mockResolvedValue(bytes)
  mocks.update.mockResolvedValue(undefined)
  mocks.log.mockResolvedValue(undefined)
  configureTransaction()
})

describe('confirmation documentée d’un changement de barème', () => {
  it('persiste la décision exacte, les clés triées, la paire révisée et les deux preuves source', async () => {
    const result = await confirmBaremeChange('C', 'admin@test', input())

    expect(result).toEqual({ status: 'confirmed', problemId, confirmedKeys: ['basic:A'] })
    const savedProblem = (currentFile.diagnostics as { comparisonAlerts: Array<{ problem: Record<string, unknown> }> }).comparisonAlerts[0].problem
    expect(savedProblem).toMatchObject({ resolutionState: 'confirmed', resolution: { actorEmail: 'admin@test', reason, reviewedKeys: ['basic:A'], comparison } })
    const details = mocks.log.mock.calls[0][0].data.details
    expect(details).toMatchObject({ version: 1, problemId, reason, reviewedKeys: ['basic:A'], comparison, candidateDataRevision: 'revision-C', referenceDataRevision: 'revision-A', evidence: [{ comparisonKey: 'basic:A', oldSource: { sheet: 'Montants', cell: 'D13', rawValue: '10', unit: 'daily' }, newSource: { sheet: 'Montants', cell: 'D14', rawValue: '30', unit: 'daily' } }] })
    expect(mocks.log.mock.calls[0][0]).toMatchObject({ data: { action: 'comparison_change_confirmed', actorEmail: 'admin@test', fileId: 'C' } })
  })

  it('refuse un problème structurel même si le client transmet confirm_change', async () => {
    currentFile = makeFile({ diagnostics: { comparison, comparisonAlerts: [{ problem: { id: problemId, category: 'parser_error', publicationEffect: 'blocking', resolutionState: 'open', affectedCount: 1, affectedKeys: ['basic:A'], allowedActions: ['confirm_change'] } }] } })

    await expect(confirmBaremeChange('C', 'admin@test', input())).resolves.toMatchObject({ status: 'error', reason: 'not_actionable' })
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('refuse une ligne devenue incomparable au lieu de confirmer son écart', async () => {
    diff.changes = [change({ warning: 'incomparable_context', type: 'ambiguous' })] as unknown as BaremeDiff['changes']

    await expect(confirmBaremeChange('C', 'admin@test', input())).resolves.toMatchObject({ status: 'error', reason: 'not_actionable' })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('refuse une source originale dont les octets ont changé', async () => {
    mocks.blob.mockResolvedValue(Buffer.from('modified source'))

    await expect(confirmBaremeChange('C', 'admin@test', input())).resolves.toMatchObject({ status: 'error', reason: 'source_unavailable' })
    expect(mocks.compare).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.log).not.toHaveBeenCalled()
  })

  it('un double POST ne peut résoudre le même groupe qu’une seule fois', async () => {
    const results = await Promise.all([
      confirmBaremeChange('C', 'admin@test', input()),
      confirmBaremeChange('C', 'admin@test', input()),
    ])

    expect(results.filter((result) => result.status === 'confirmed')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'error')).toHaveLength(1)
    expect(mocks.log).toHaveBeenCalledOnce()
  })
})
