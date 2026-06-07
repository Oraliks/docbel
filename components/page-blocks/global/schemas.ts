import { z } from 'zod'

export const globalRefSchema = z.object({
  globalBlockId: z.string().max(64).default(''),
  /** Per-instance prop overrides merged over the resolved global block. */
  overrides: z.record(z.string(), z.unknown()).optional(),
})

export const globalSchemas = {
  globalRef: globalRefSchema,
} as const
