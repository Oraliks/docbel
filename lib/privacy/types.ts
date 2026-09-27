export const PRIVACY_INVENTORY_VERSION = 1 as const

export type PrivacyRelationKind = "subject" | "actor" | "indirect_email"

export type PrivacyTechnicalAction =
  | "delete_candidate"
  | "anonymize_candidate"
  | "detach_candidate"
  | "retain_shared"
  | "review"

export type PrivacyPolicyStatus = "unapproved" | "review_required"

export interface PrivacyInventoryEntry {
  source: string
  relation: string
  relationKind: PrivacyRelationKind
  count: number
  technicalAction: PrivacyTechnicalAction
  policyStatus: PrivacyPolicyStatus
  exportDataset: string | null
  reason: string
}

export interface PrivacySubjectSummary {
  id: string
  email: string
  name: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface PrivacyInventory {
  version: typeof PRIVACY_INVENTORY_VERSION
  subject: PrivacySubjectSummary
  entries: PrivacyInventoryEntry[]
  unresolvedScopes: Array<{ source: string; reason: string }>
  inventoryHash: string
  policy: {
    executionEnabled: false
    reason: "retention_matrix_unapproved"
  }
}

export interface PrivacyDeletionPreview {
  inventory: PrivacyInventory
  summary: Record<PrivacyTechnicalAction, number>
  execution: {
    allowed: false
    code: "retention_matrix_unapproved"
    ambiguousSources: string[]
  }
}
