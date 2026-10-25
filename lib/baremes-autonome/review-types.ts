import type { Difference, Snapshot, Source } from './types'

export type ScopeEvidence = {
  sheet: string
  state: 'read' | 'absent' | 'unreadable'
  region: string | null
  headers: Source[]
  presentSheets: string[]
  occupiedCells?: string[]
}
export type ReviewKind = 'amount' | 'removal' | 'context'
export type DecisionStatus = 'accepted' | 'revoked' | 'deferred'
export type DecisionView = {
  id: string
  taskId: string
  kind: string
  status: string
  reason: string
  actorId: string
  createdAt: string
  officialSource: string | null
  regulatoryScope?: string | null
  effectiveDate: string | null
  fingerprint: string
}
export type ReviewTask = {
  id: string
  kind: ReviewKind
  sheet: string
  table: string
  memberCount: number
  memberKeys: string[]
  scopeDigest: string
  status: 'pending' | 'accepted'
  admissible: boolean
  decision: DecisionView | null
}
export type ReviewState = {
  fingerprint: string
  policyVersion: number
  thresholdPercent: string
  tasks: ReviewTask[]
  pending: number
  accepted: number
  affectedRows: number
  technical: boolean
  availability: 'technical' | 'review' | 'future' | 'date' | 'published' | 'ready'
  themes: Array<{ sheet: string; changed: number; total: number; pending: number }>
}
export type ReviewDetails = {
  task: ReviewTask
  fingerprint: string
  snapshot: Snapshot
  members: Difference[]
  evidence: ScopeEvidence
  deltas: Record<string, { delta: string; percent: string | null }>
}
export type RegulatoryScope = {
  region: string
  population: string
  newRequests: string
  existingCases: string
}
export type DecisionInput = {
  snapshot: Snapshot
  fingerprint: string
  taskId: string
  memberKeys: string[]
  scopeDigest: string
  status: DecisionStatus
  reason: string
  checkedSources: boolean
  documentaryOnly: boolean
  effectiveDate?: string
  officialSource?: string
  regulatoryScope?: RegulatoryScope
  previousDecisionId?: string
}
