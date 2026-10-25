/** Independent reference data: no runtime links to the historical rate domain. */
export type ChangeKind = 'modified' | 'added' | 'absent' | 'unchanged'
export type Source = { sheet: string; cell: string; raw: string; formula: string | null }
export type RateValue = {
  key: string
  table: string
  code: string
  category?: 'A' | 'N' | 'B'
  label: string
  context: string[]
  unit: 'EUR/day' | 'EUR/month' | 'EUR' | 'ratio' | 'number'
  value: string
  source: Source
  indexation?: { value: string; source: Source }
}
export type ReadingIssue = { code: string; sheet: string; cell?: string; blocking: boolean }
export type Coverage = { contractVersion: 1; auxiliaryCells: number; tables: Array<{ sheet: string; mappedCells: number; auxiliaryCells: number }> }
export type Reading = { effectiveFrom: string | null; values: RateValue[]; sheets: string[]; issues: ReadingIssue[]; parserVersion: number; identityVersion?: number; coverage?: Coverage }
export type VersionRef = { id: string; name: string; revision: string; effectiveFrom: string | null; createdAt: string; publishedAt: string | null; count: number }
export type Difference = { key: string; kind: ChangeKind; before: RateValue | null; after: RateValue | null; contextChanged: boolean }
export type Snapshot = { candidateId: string; candidateRevision: string; referenceId: string | null; referenceRevision: string | null; generation: number; digest: string }
export type Workspace = {
  candidate: VersionRef
  reference: VersionRef | null
  snapshot: Snapshot
  counts: Record<ChangeKind, number>
  issues: ReadingIssue[]
  sheets: string[]
  items: Difference[]
  total: number
  page: number
  canPublish: boolean
  coverage?: Coverage
}
