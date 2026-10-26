import { createHash } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashLookupValue } from '../importLookupCsv'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  tableFind: vi.fn(),
  proposalFind: vi.fn(),
  proposalUpdate: vi.fn(),
  proposalUpdateMany: vi.fn(),
  entriesFind: vi.fn(),
  entryCount: vi.fn(),
  createMany: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    lookupImportProposal: { updateMany: mocks.proposalUpdateMany },
  },
  withDbRetry: (callback: () => unknown) => callback(),
}))

import { publishLookupImportProposal } from '../importWorkflow'

const tableSnapshot = {
  id: 'table-1', slug: 'lookup', prefix: 'L', labelFr: 'Lookup', labelNl: 'Lookup',
  sourcePath: null, exportName: null, updatedAt: new Date('2026-10-20T00:00:00Z'),
  publishedRevision: 4, requiresApproval: false,
}
const sourceContent = 'Code;Description française;Description néerlandaise\n'
const sourceSha256 = createHash('sha256').update(sourceContent).digest('hex')

function makeProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1', tableId: 'table-1', state: 'prepared',
    sourceContent, sourceSha256, sourceFileName: 'export.csv',
    parserVersion: 'lookup-csv-2', transformation: { columns: 'auto-detect-v1', duplicatePolicy: 'reject-conflicting' },
    baseRevision: 4,
    baseHash: hashLookupValue({ table: tableSnapshot, entries: [] }),
    payloadHash: hashLookupValue([]), normalizedPayload: [],
    diff: { added: [], modified: [], absentFromExport: [] }, approvals: [],
    ...overrides,
  }
}

function setup(proposal = makeProposal()) {
  let state = proposal.state
  mocks.tableFind.mockResolvedValue(tableSnapshot)
  mocks.entriesFind.mockResolvedValue([])
  mocks.entryCount.mockResolvedValue(0)
  mocks.createMany.mockResolvedValue({ count: 1 })
  mocks.executeRaw.mockResolvedValue(1)
  mocks.queryRaw.mockResolvedValue([])
  mocks.proposalFind.mockImplementation(async (args: { select?: unknown }) =>
    args.select ? { id: proposal.id, tableId: proposal.tableId } : { ...proposal, state }
  )
  mocks.proposalUpdate.mockImplementation(async (args: { data: { state?: string } }) => {
    if (args.data.state) state = args.data.state
    return {}
  })
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
    lookupTable: { findUnique: mocks.tableFind, update: vi.fn().mockResolvedValue({ slug: 'lookup', publishedRevision: 5 }) },
    lookupImportProposal: { findUnique: mocks.proposalFind, update: mocks.proposalUpdate },
    lookupEntry: { findMany: mocks.entriesFind, count: mocks.entryCount, createMany: mocks.createMany },
  }))
  mocks.proposalUpdateMany.mockResolvedValue({ count: 1 })
  return { proposal, getState: () => state }
}

describe('Lookup publication proposal safeguards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invalidates a proposal when the approved source content has changed', async () => {
    setup(makeProposal({ sourceContent: `${sourceContent}tampered` }))
    const result = await publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' })
    expect(result.state).toBe('stale')
    expect(mocks.proposalUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'stale' }) }))
    expect(mocks.createMany).not.toHaveBeenCalled()
  })

  it('marks the comparison stale after the published reference revision changes', async () => {
    setup(makeProposal({ baseRevision: 3 }))
    const result = await publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' })
    expect(result.state).toBe('stale')
    expect(mocks.createMany).not.toHaveBeenCalled()
  })

  it('requires two distinct approvals even if duplicated values arrive at runtime', async () => {
    setup(makeProposal({
      baseHash: hashLookupValue({ table: { ...tableSnapshot, requiresApproval: true }, entries: [] }),
      approvals: [{ approverEmail: 'same@example.test' }, { approverEmail: 'same@example.test' }],
    }))
    mocks.tableFind.mockResolvedValue({ ...tableSnapshot, requiresApproval: true })
    const result = await publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' })
    expect(result.state).toBe('pending_approvals')
    expect(result.approvalsCount).toBe(1)
    expect(mocks.createMany).not.toHaveBeenCalled()
  })

  it('clears the old publication error when a failed retry returns to approval review', async () => {
    const requiresApprovalTable = { ...tableSnapshot, requiresApproval: true }
    setup(makeProposal({
      state: 'failed',
      errorMessage: 'write failed',
      baseHash: hashLookupValue({ table: requiresApprovalTable, entries: [] }),
    }))
    mocks.tableFind.mockResolvedValue(requiresApprovalTable)

    const result = await publishLookupImportProposal({
      proposalId: 'proposal-1',
      publishedBy: 'admin@example.test',
      retryFailed: true,
    })

    expect(result.state).toBe('pending_approvals')
    expect(mocks.proposalUpdate).toHaveBeenCalledWith({
      where: { id: 'proposal-1' },
      data: { state: 'prepared', errorMessage: null },
    })
    expect(mocks.createMany).not.toHaveBeenCalled()
  })

  it('rolls back and records a failed state if a write chunk fails', async () => {
    const entry = {
      code: 'A', labelFr: 'Alpha', labelNl: 'Alpha NL', labelDe: null, labelEn: null,
      validFrom: null, validUntil: null, metadata: null, existingId: null,
    }
    const proposal = makeProposal({ normalizedPayload: [entry], payloadHash: hashLookupValue([entry]) })
    setup(proposal)
    mocks.createMany.mockRejectedValue(new Error('write failed'))
    await expect(publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' })).rejects.toThrow('write failed')
    expect(mocks.proposalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'proposal-1', state: 'prepared' },
      data: expect.objectContaining({ state: 'failed' }),
    }))
  })

  it('makes concurrent duplicate publication idempotent', async () => {
    const { getState } = setup()
    let previous = Promise.resolve()
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      let release!: () => void
      const turn = new Promise<void>((resolve) => { release = resolve })
      const prior = previous
      previous = turn
      await prior
      try {
        return await callback({
          $queryRaw: mocks.queryRaw,
          $executeRaw: mocks.executeRaw,
          lookupTable: { findUnique: mocks.tableFind, update: vi.fn().mockResolvedValue({ slug: 'lookup', publishedRevision: 5 }) },
          lookupImportProposal: { findUnique: mocks.proposalFind, update: mocks.proposalUpdate },
          lookupEntry: { findMany: mocks.entriesFind, count: mocks.entryCount, createMany: mocks.createMany },
        })
      } finally { release() }
    })
    const results = await Promise.all([
      publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' }),
      publishLookupImportProposal({ proposalId: 'proposal-1', publishedBy: 'admin@example.test' }),
    ])
    expect(results.map((result) => result.state).sort()).toEqual(['already_published', 'published'])
    expect(getState()).toBe('published')
    expect(mocks.proposalUpdate).toHaveBeenCalledTimes(1)
  })
})
