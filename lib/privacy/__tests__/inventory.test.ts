import { describe, expect, it } from "vitest"
import { buildDeletionPreview } from "../inventory"
import type { PrivacyInventory } from "../types"

const inventory: PrivacyInventory = {
  version: 1,
  subject: {
    id: "user-1",
    email: "subject@example.test",
    name: "Subject",
    role: "user",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  entries: [
    {
      source: "UserProfile",
      relation: "userId",
      relationKind: "subject",
      count: 1,
      technicalAction: "delete_candidate",
      policyStatus: "unapproved",
      exportDataset: "profile",
      reason: "owned",
    },
    {
      source: "KnowledgeSource",
      relation: "createdById",
      relationKind: "actor",
      count: 2,
      technicalAction: "retain_shared",
      policyStatus: "review_required",
      exportDataset: null,
      reason: "shared",
    },
  ],
  unresolvedScopes: [],
  inventoryHash: "hash",
  policy: { executionEnabled: false, reason: "retention_matrix_unapproved" },
}

describe("privacy deletion preview", () => {
  it("sépare les candidats effaçables des données partagées conservées", () => {
    const preview = buildDeletionPreview(inventory)
    expect(preview.summary.delete_candidate).toBe(1)
    expect(preview.summary.retain_shared).toBe(2)
    expect(preview.execution.ambiguousSources).toEqual(["KnowledgeSource.createdById"])
  })

  it("reste inexécutable tant que la matrice de conservation n'est pas approuvée", () => {
    expect(buildDeletionPreview(inventory).execution).toMatchObject({
      allowed: false,
      code: "retention_matrix_unapproved",
    })
  })
})
