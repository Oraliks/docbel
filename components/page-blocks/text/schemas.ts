import { z } from 'zod'

export const headingSchema = z.object({
  text: z.string().max(500).default('Titre'),
  level: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
    .default(2),
  variant: z.enum(['default', 'display', 'gradient']).optional(),
})

export const textSchema = z.object({
  html: z.string().max(50000).default('<p>Commencez à écrire…</p>'),
  variant: z.enum(['default', 'lead', 'small']).optional(),
})

export const quoteSchema = z.object({
  text: z.string().max(2000).default('Une citation inspirante.'),
  author: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  variant: z.enum(['simple', 'pull', 'card']).optional(),
})

export const dividerSchema = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'gradient']).optional(),
  thickness: z.number().min(1).max(20).optional(),
})

export const spacerSchema = z.object({
  height: z.number().min(0).max(800).default(48),
})

export const textSchemas = {
  heading: headingSchema,
  text: textSchema,
  quote: quoteSchema,
  divider: dividerSchema,
  spacer: spacerSchema,
} as const
