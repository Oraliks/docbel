import { z } from 'zod'

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const ALLOWED_LINK_REGEX = /^(https?:\/\/|mailto:|tel:|\/|#)/i

const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Couleur hex invalide (#RGB, #RRGGBB ou #RRGGBBAA)')

const SafeUrlSchema = z
  .string()
  .max(2048, 'URL trop longue')
  .refine((v) => v === '' || /^(https?:\/\/|\/)/i.test(v), 'URL invalide')

const SafeLinkSchema = z
  .string()
  .max(2048, 'Lien trop long')
  .refine((v) => v === '' || ALLOWED_LINK_REGEX.test(v), 'Lien invalide')

const HeroPropsSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  bgColor: HexColorSchema.optional(),
  image: SafeUrlSchema.optional(),
})

const CtaPropsSchema = z.object({
  text: z.string().max(120),
  link: SafeLinkSchema,
  variant: z.enum(['primary', 'secondary']),
})

const ImagePropsSchema = z.object({
  url: SafeUrlSchema,
  alt: z.string().max(300),
  caption: z.string().max(300).optional(),
  width: z.string().max(20).optional(),
  height: z.string().max(20).optional(),
})

const FeaturesItemSchema = z.object({
  icon: z.string().max(40).optional(),
  title: z.string().max(120),
  description: z.string().max(500),
})

const FeaturesPropsSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(FeaturesItemSchema).max(24),
})

const SectionPropsSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  bgColor: HexColorSchema.optional(),
  padding: z.enum(['small', 'medium', 'large']).optional(),
})

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1).max(64), type: z.literal('hero'), props: HeroPropsSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal('cta'), props: CtaPropsSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal('image'), props: ImagePropsSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal('features'), props: FeaturesPropsSchema }),
  z.object({ id: z.string().min(1).max(64), type: z.literal('section'), props: SectionPropsSchema }),
])

export const BlocksSchema = z.array(BlockSchema).max(200)

const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Slug invalide (lettres minuscules, chiffres, tirets)')

export const CreatePageSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(200),
  slug: z.union([SlugSchema, z.literal('')]).optional(),
  content: BlocksSchema.optional(),
})

const NullableTrimmedString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v))

export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: SlugSchema.optional(),
  content: BlocksSchema.optional(),
  status: z.enum(['draft', 'published']).optional(),
  metaTitle: NullableTrimmedString(60),
  metaDesc: NullableTrimmedString(160),
  ogImage: z
    .union([z.literal(''), z.string().url().max(2048)])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
})

export type CreatePageInput = z.infer<typeof CreatePageSchema>
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>
export type ValidatedBlock = z.infer<typeof BlockSchema>

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'page'
}
