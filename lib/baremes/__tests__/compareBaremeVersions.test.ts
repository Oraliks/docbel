import { describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ file: vi.fn(), amounts: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { baremeFile: { findUnique: mocks.file, findFirst: vi.fn() }, baremeAmount: { findMany: mocks.amounts } }, withDbRetry: <T>(operation: () => T) => operation() }))
import { buildBaremeDiff, compareBaremeVersions, dataRevisionFromAmounts, detectAnomaliesFromDiff } from '../compareBaremeVersions'
import type { BaremeComparableAmount, BaremeComparisonFileRef } from '../types'

const reference: BaremeComparisonFileRef = { id: 'old', name: 'old.xlsx', status: 'published', fileType: 'onem-rates', validFrom: '2026-01-01T00:00:00.000Z', dataRevision: 'old-revision' }
const candidate: BaremeComparisonFileRef = { id: 'new', name: 'new.xlsx', status: 'draft', fileType: 'onem-rates', validFrom: '2026-04-01T00:00:00.000Z', dataRevision: 'new-revision' }
function amount(id: string, key: string, value: number, overrides: Partial<BaremeComparableAmount> = {}): BaremeComparableAmount {
  return { id, comparisonKey: key, amount: value, sourceSheet: 'Feuille 1', category: 'full_unemployment', allocationCode: key, salaryCode: null, article: null, labelFr: key, labelNl: null, unit: 'daily', minDailySalary: null, maxDailySalary: null, trace: { sourceCell: `${id}1`, sourceRowIndex: 1, sourceColumnIndex: 1, rawValue: String(value), normalizedValue: value }, ...overrides }
}

describe('révision des données comparées', () => {
  it('invalide la révision quand la provenance AcroForm / cellule change sans modifier le montant', async () => {
    const dbRows = {
      old: [{ id: 'old-1', sourceSheet: 'F', category: 'full_unemployment', allocationCode: 'key', salaryCode: null, article: null, labelFr: 'key', labelNl: null, unit: 'daily', amount: 10, minDailySalary: null, maxDailySalary: null, comparisonKey: 'key', rawData: { trace: { sourceCell: 'D7', sourceRowIndex: 7, sourceColumnIndex: 4, rawValue: '10', normalizedValue: 10, rate: 0.6, mappingFile: 'map.ts', transformTemplate: 'basic' } } }],
      new: [{ id: 'new-1', sourceSheet: 'F', category: 'full_unemployment', allocationCode: 'key', salaryCode: null, article: null, labelFr: 'key', labelNl: null, unit: 'daily', amount: 10, minDailySalary: null, maxDailySalary: null, comparisonKey: 'key', rawData: { trace: { sourceCell: 'D8', sourceRowIndex: 8, sourceColumnIndex: 4, rawValue: '10', normalizedValue: 10, rate: 0.6, mappingFile: 'map.ts', transformTemplate: 'basic' } } }],
    }
    mocks.file.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, name: `${where.id}.xlsx`, status: where.id === 'new' ? 'draft' : 'published', fileType: 'onem-rates', validFrom: new Date('2026-04-01T00:00:00.000Z') }))
    mocks.amounts.mockImplementation(async ({ where }: { where: { fileId: 'old' | 'new' } }) => dbRows[where.fileId])

    const before = await compareBaremeVersions('new', 'old')
    dbRows.new[0].rawData.trace.sourceCell = 'D9'
    const after = await compareBaremeVersions('new', 'old')

    expect(after.candidateDataRevision).not.toBe(before.candidateDataRevision)
    expect(after.referenceDataRevision).toBe(before.referenceDataRevision)
  })
})
describe('buildBaremeDiff', () => {
  it('couvre les quatre états, les attributs et la précision à quatre décimales', () => {
    const diff = buildBaremeDiff(
      [amount('n1', 'modified', 10.1235), amount('n2', 'unchanged', 20), amount('n3', 'added', 30), amount('n4', 'unit', 40, { unit: 'monthly' }), amount('n5', 'attribute', 50, { allocationCode: 'changed-code' })],
      [amount('o1', 'modified', 10.1234), amount('o2', 'unchanged', 20), amount('o4', 'unit', 40, { unit: 'daily' }), amount('o5', 'disappeared', 50), amount('o6', 'attribute', 50)],
      candidate, reference
    )
    expect(diff.countsByType).toMatchObject({ modified: 3, unchanged: 1, added: 1, disappeared: 1, ambiguous: 0 })
    expect(diff.changes.find((row) => row.key === 'modified')).toMatchObject({ type: 'modified', amountChanged: true, oldValue: 10.1234, newValue: 10.1235 })
    expect(diff.changes.find((row) => row.key === 'attribute')?.changedAttributes).toEqual(['allocationCode'])
    expect(diff.changes.find((row) => row.key === 'unit')).toMatchObject({ type: 'modified', warning: 'incomparable_context', amountComparable: false })
  })
  it('isole les collisions au lieu de les rapprocher arbitrairement', () => {
    const diff = buildBaremeDiff([amount('n1', 'duplicate', 10), amount('n2', 'duplicate', 11)], [amount('o1', 'duplicate', 10)], candidate, reference)
    expect(diff.countsByType.ambiguous).toBe(3)
    expect(diff.changes.every((row) => row.warning === 'ambiguous_identity')).toBe(true)
  })
  it('traite les changements de contexte comme modifiés, sans delta économique comparable', () => {
    const old = [
      amount('o1', 'unit', 10),
      amount('o2', 'category', 20),
      amount('o3', 'article', 30),
      amount('o4', 'rate', 40, { trace: { ...amount('o4', 'rate', 40).trace!, rate: 0.6 } }),
    ]
    const next = [
      amount('n1', 'unit', 100, { unit: 'monthly' }),
      amount('n2', 'category', 200, { category: 'half_unemployment' }),
      amount('n3', 'article', 300, { article: 'article différent' }),
      amount('n4', 'rate', 400, { trace: { ...amount('n4', 'rate', 400).trace!, rate: 0.65 } }),
    ]

    const diff = buildBaremeDiff(next, old, candidate, reference)

    expect(diff.countsByType.ambiguous).toBe(0)
    expect(diff.countsByType.modified).toBe(4)
    expect(diff.changes.every((change) => change.warning === 'incomparable_context')).toBe(true)
    expect(diff.changes.every((change) => change.amountComparable === false)).toBe(true)
    expect(detectAnomaliesFromDiff(diff)).toEqual([])
  })
  it('ne masque pas un changement de taux lorsque la valeur numérique reste égale', () => {
    const old = amount('o1', 'rate-equal', 100, { trace: { ...amount('o1', 'rate-equal', 100).trace!, rate: 0.6 } })
    const next = amount('n1', 'rate-equal', 100, { trace: { ...amount('n1', 'rate-equal', 100).trace!, rate: 0.4 } })

    const diff = buildBaremeDiff([next], [old], candidate, reference)

    expect(diff.changes[0]).toMatchObject({ type: 'modified', amountChanged: false, amountComparable: false, changedAttributes: ['rate'], warning: 'incomparable_context' })
  })
  it('n’émet pas de variation en pourcentage si le montant passe du journalier au mensuel', () => {
    const diff = buildBaremeDiff(
      [amount('n1', 'unit-rate', 200, { unit: 'monthly' })],
      [amount('o1', 'unit-rate', 100, { unit: 'daily' })], candidate, reference,
    )

    expect(diff.changes[0]).toMatchObject({ type: 'modified', amountChanged: true, amountComparable: false })
    expect(detectAnomaliesFromDiff(diff)).toEqual([])
  })
  it('reconnaît une variation depuis zéro sans calculer un pourcentage infini', () => {
    const diff = buildBaremeDiff([amount('n1', 'zero-base', 12)], [amount('o1', 'zero-base', 0)], candidate, reference)

    expect(diff.countsByType.modified).toBe(1)
    expect(diff.changes[0]).toMatchObject({ type: 'modified', oldValue: 0, newValue: 12, amountChanged: true })
    expect(detectAnomaliesFromDiff(diff)).toEqual([])
  })
  it('réconcilie les totaux lorsqu’aucune identité n’est ambiguë', () => {
    const diff = buildBaremeDiff([amount('n1', 'same', 1), amount('n2', 'added', 2)], [amount('o1', 'same', 1), amount('o2', 'gone', 3)], candidate, reference)
    expect(2).toBe(diff.countsByType.unchanged + diff.countsByType.modified + diff.countsByType.disappeared)
    expect(2).toBe(diff.countsByType.unchanged + diff.countsByType.modified + diff.countsByType.added)
  })
  it('conserve plus de 100 changements pour la pagination et l’export serveur', () => {
    const oldRows = Array.from({ length: 135 }, (_, index) => amount(`o${index}`, `key-${index}`, index))
    const newRows = Array.from({ length: 135 }, (_, index) => amount(`n${index}`, `key-${index}`, index + 0.0001))
    const diff = buildBaremeDiff(newRows, oldRows, candidate, reference)
    expect(diff.changes).toHaveLength(135)
    expect(diff.countsByType.modified).toBe(135)
    expect(diff.changes.slice(100, 135)).toHaveLength(35)
  })
})

it('inclut le taux, la formule et la justification de transformation dans la révision des données', () => {
  const original = amount('row', 'key', 100, { trace: { ...amount('row', 'key', 100).trace!, rate: 0.6, sourceFormula: 'ROUND(A1,2)', transformReason: 'Taux de la colonne A1' } })
  const changedRate = { ...original, trace: { ...original.trace!, rate: 0.4 } }
  const changedFormula = { ...original, trace: { ...original.trace!, sourceFormula: 'ROUND(A1/2,2)' } }

  expect(dataRevisionFromAmounts([changedRate])).not.toBe(dataRevisionFromAmounts([original]))
  expect(dataRevisionFromAmounts([changedFormula])).not.toBe(dataRevisionFromAmounts([original]))
})
