import { z } from 'zod'

export const globalRefSchema = z.object({
  globalBlockId: z.string().max(64).default(''),
})

export const globalSchemas = {
  globalRef: globalRefSchema,
} as const
