import { z } from 'zod'

export const CreatePageSchema = z.object({
  title: z.string().min(1, 'Titre requis'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)')
    .optional()
    .or(z.literal('')),
  content: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['hero', 'cta', 'image', 'features', 'section']),
        props: z.record(z.string(), z.any()),
      })
    )
    .optional(),
})

export const UpdatePageSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)')
    .optional(),
  content: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['hero', 'cta', 'image', 'features', 'section']),
        props: z.record(z.string(), z.any()),
      })
    )
    .optional(),
  status: z.enum(['draft', 'published']).optional(),
  metaTitle: z
    .string()
    .optional()
    .nullable()
    .transform(v => (v === '' ? null : v)),
  metaDesc: z
    .string()
    .optional()
    .nullable()
    .transform(v => (v === '' ? null : v)),
  ogImage: z
    .union([
      z.literal(''),
      z.string().url()
    ])
    .optional()
    .nullable()
    .transform(v => (v === '' ? null : v)),
})

export type CreatePageInput = z.infer<typeof CreatePageSchema>
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
