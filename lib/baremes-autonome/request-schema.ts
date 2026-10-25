import { z } from 'zod'
export const snapshotSchema = z
  .object({
    candidateId: z.string().min(1).max(100),
    candidateRevision: z.string().length(64),
    referenceId: z.string().max(100).nullable(),
    referenceRevision: z.string().length(64).nullable(),
    generation: z.number().int().nonnegative(),
    digest: z.string().length(64),
    analysis: z.string().length(64).optional(),
  })
  .strict()
export const decisionSchema = z
  .object({
    snapshot: snapshotSchema,
    fingerprint: z.string().length(64),
    taskId: z.string().length(64),
    memberKeys: z.array(z.string().max(500)).min(1).max(30000),
    scopeDigest: z.string().length(64),
    status: z.enum(['accepted', 'revoked', 'deferred']),
    reason: z.string().trim().min(8).max(1000),
    checkedSources: z.boolean(),
    documentaryOnly: z.boolean(),
    effectiveDate: z.iso.date().optional(),
    officialSource: z.url().max(2000).optional(),
    regulatoryScope: z
      .object({
        region: z.string().trim().min(2).max(200),
        population: z.string().trim().min(3).max(200),
        newRequests: z.string().trim().min(3).max(200),
        existingCases: z.string().trim().min(3).max(200),
      })
      .strict()
      .optional(),
    previousDecisionId: z.string().max(100).optional(),
  })
  .strict()
