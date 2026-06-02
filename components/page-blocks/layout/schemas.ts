import { z } from 'zod'

export const sectionSchema = z.object({
  bgType: z.enum(['none', 'color', 'gradient', 'image']).optional(),
  bgColor: z.string().optional(),
  bgGradient: z.string().max(500).optional(),
  bgImage: z.string().max(4096).optional(),
  bgOverlay: z.string().optional(),
  fullWidth: z.boolean().optional(),
})

export const containerSchema = z.object({
  width: z.enum(['sm', 'md', 'lg', 'xl', 'full']).optional(),
})

export const columnsSchema = z.object({
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

export const layoutSchemas = {
  section: sectionSchema,
  container: containerSchema,
  columns: columnsSchema,
} as const
