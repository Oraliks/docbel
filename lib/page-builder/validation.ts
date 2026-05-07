import { z } from 'zod'

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3,8})$/
const ALLOWED_LINK_REGEX = /^(https?:\/\/|mailto:|tel:|\/|#)/i

const HexColor = z.string().regex(HEX_COLOR_REGEX).optional()
const SafeUrl = z
  .string()
  .max(4096)
  .refine((v) => v === '' || /^(https?:\/\/|\/|data:image\/)/i.test(v), 'URL invalide')
const SafeLink = z
  .string()
  .max(4096)
  .refine((v) => v === '' || ALLOWED_LINK_REGEX.test(v), 'Lien invalide')

// ────────────────────────── Style / Layout / Advanced ──────────────────────────

const StyleSchema = z
  .object({
    fontFamily: z.string().max(120).optional(),
    fontSize: z.number().min(8).max(200).optional(),
    fontWeight: z.union([z.literal(300), z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).optional(),
    lineHeight: z.number().min(0.5).max(4).optional(),
    letterSpacing: z.number().min(-5).max(20).optional(),
    textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
    textColor: HexColor,
    bgColor: HexColor,
    borderWidth: z.number().min(0).max(20).optional(),
    borderColor: HexColor,
    borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    borderRadius: z.number().min(0).max(200).optional(),
    shadow: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .partial()

const LayoutSchema = z
  .object({
    width: z.string().max(40).optional(),
    maxWidth: z.string().max(40).optional(),
    height: z.string().max(40).optional(),
    minHeight: z.string().max(40).optional(),
    paddingTop: z.number().min(0).max(500).optional(),
    paddingRight: z.number().min(0).max(500).optional(),
    paddingBottom: z.number().min(0).max(500).optional(),
    paddingLeft: z.number().min(0).max(500).optional(),
    marginTop: z.number().min(-500).max(500).optional(),
    marginRight: z.number().min(-500).max(500).optional(),
    marginBottom: z.number().min(-500).max(500).optional(),
    marginLeft: z.number().min(-500).max(500).optional(),
    align: z.enum(['left', 'center', 'right', 'stretch']).optional(),
    hideOnDesktop: z.boolean().optional(),
    hideOnTablet: z.boolean().optional(),
    hideOnMobile: z.boolean().optional(),
  })
  .partial()

const AdvancedSchema = z
  .object({
    htmlId: z.string().max(120).optional(),
    className: z.string().max(500).optional(),
    anchor: z.string().max(120).optional(),
    animation: z
      .enum(['none', 'fade-in', 'fade-up', 'fade-down', 'slide-left', 'slide-right', 'zoom-in'])
      .optional(),
    animationDelay: z.number().min(0).max(5000).optional(),
    animateOnScroll: z.boolean().optional(),
    showIf: z.enum(['always', 'loggedIn', 'loggedOut']).optional(),
  })
  .partial()

const MetaSchema = z
  .object({
    locked: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .partial()

const ResponsiveSchema = z
  .object({
    tablet: z
      .object({ style: StyleSchema.optional(), layout: LayoutSchema.optional() })
      .optional(),
    mobile: z
      .object({ style: StyleSchema.optional(), layout: LayoutSchema.optional() })
      .optional(),
  })
  .partial()

// ────────────────────────── Block-specific props ──────────────────────────

const HeadingProps = z.object({
  text: z.string().max(500),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  variant: z.enum(['default', 'display', 'gradient']).optional(),
})
const TextProps = z.object({
  html: z.string().max(50000),
  variant: z.enum(['default', 'lead', 'small']).optional(),
})
const QuoteProps = z.object({
  text: z.string().max(2000),
  author: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  variant: z.enum(['simple', 'pull', 'card']).optional(),
})
const DividerProps = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'gradient']).optional(),
  thickness: z.number().min(1).max(20).optional(),
})
const SpacerProps = z.object({ height: z.number().min(0).max(800) })
const ImageProps = z.object({
  url: SafeUrl,
  alt: z.string().max(500),
  caption: z.string().max(500).optional(),
  ratio: z.enum(['auto', '1:1', '4:3', '16:9', '21:9']).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  rounded: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
})
const VideoProps = z.object({
  url: z.string().max(2048),
  provider: z.enum(['youtube', 'vimeo', 'tiktok', 'dailymotion', 'loom', 'mp4']),
  caption: z.string().max(500).optional(),
  autoplay: z.boolean().optional(),
  controls: z.boolean().optional(),
  fileId: z.string().max(64).optional(),
})
const GalleryProps = z.object({
  items: z
    .array(z.object({ url: SafeUrl, alt: z.string().max(500), caption: z.string().max(500).optional() }))
    .max(50),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['grid', 'masonry']).optional(),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})
const EmbedProps = z.object({
  html: z.string().max(20000),
  height: z.number().min(50).max(2000).optional(),
})
const SectionProps = z.object({
  bgType: z.enum(['none', 'color', 'gradient', 'image']).optional(),
  bgColor: HexColor,
  bgGradient: z.string().max(500).optional(),
  bgImage: SafeUrl.optional(),
  bgOverlay: HexColor,
  fullWidth: z.boolean().optional(),
})
const ContainerProps = z.object({
  width: z.enum(['sm', 'md', 'lg', 'xl', 'full']).optional(),
})
const ColumnsProps = z.object({
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})
const HeroProps = z.object({
  title: z.string().max(500),
  subtitle: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  ctaText: z.string().max(120).optional(),
  ctaLink: SafeLink.optional(),
  ctaSecondaryText: z.string().max(120).optional(),
  ctaSecondaryLink: SafeLink.optional(),
  image: SafeUrl.optional(),
  bgColor: HexColor,
  variant: z.enum(['centered', 'split', 'minimal', 'fullbleed']).optional(),
})
const FeaturesProps = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z
    .array(z.object({ icon: z.string().max(40).optional(), title: z.string().max(200), description: z.string().max(1000) }))
    .max(24),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['cards', 'icons', 'centered']).optional(),
})
const CtaProps = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  text: z.string().max(120),
  link: SafeLink,
  secondaryText: z.string().max(120).optional(),
  secondaryLink: SafeLink.optional(),
  variant: z.enum(['inline', 'banner', 'card']).optional(),
  buttonStyle: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
  buttonSize: z.enum(['sm', 'md', 'lg']).optional(),
})
const FaqProps = z.object({
  title: z.string().max(500).optional(),
  items: z
    .array(z.object({ question: z.string().max(500), answer: z.string().max(2000) }))
    .max(50),
  variant: z.enum(['simple', 'bordered', 'card']).optional(),
})
const TestimonialProps = z.object({
  title: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        quote: z.string().max(2000),
        author: z.string().max(200),
        role: z.string().max(200).optional(),
        avatar: SafeUrl.optional(),
      })
    )
    .max(20),
  variant: z.enum(['single', 'grid', 'carousel']).optional(),
})
const StatsProps = z.object({
  title: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        value: z.string().max(40),
        label: z.string().max(200),
        prefix: z.string().max(20).optional(),
        suffix: z.string().max(20).optional(),
      })
    )
    .max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['simple', 'cards', 'centered']).optional(),
})

// ────────────────────────── New block schemas ──────────────────────────

const CardProps = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  body: z.string().max(20000).optional(),
  image: SafeUrl.optional(),
  ctaText: z.string().max(120).optional(),
  ctaLink: SafeLink.optional(),
  variant: z.enum(['default', 'bordered', 'elevated', 'gradient']).optional(),
})
const AccordionProps = z.object({
  items: z
    .array(z.object({ title: z.string().max(500), content: z.string().max(5000) }))
    .max(50),
  type: z.enum(['single', 'multiple']).optional(),
  variant: z.enum(['default', 'bordered', 'separated']).optional(),
})
const TabsProps = z.object({
  items: z
    .array(z.object({ label: z.string().max(120), content: z.string().max(20000) }))
    .max(20),
  variant: z.enum(['default', 'pills', 'underline']).optional(),
})
const AlertProps = z.object({
  title: z.string().max(200).optional(),
  message: z.string().max(2000),
  variant: z.enum(['info', 'success', 'warning', 'destructive']).optional(),
  dismissible: z.boolean().optional(),
  icon: z.string().max(40).optional(),
})
const BadgesProps = z.object({
  title: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        label: z.string().max(120),
        variant: z.enum(['default', 'secondary', 'outline', 'destructive']).optional(),
        color: HexColor,
      })
    )
    .max(50),
  align: z.enum(['left', 'center']).optional(),
})
const ProgressProps = z.object({
  label: z.string().max(200).optional(),
  value: z.number().min(0).max(100),
  showValue: z.boolean().optional(),
  color: HexColor,
  variant: z.enum(['default', 'segmented', 'circular']).optional(),
})
const ButtonGroupProps = z.object({
  items: z
    .array(
      z.object({
        text: z.string().max(120),
        link: SafeLink,
        variant: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
        icon: z.string().max(40).optional(),
      })
    )
    .max(10),
  align: z.enum(['left', 'center', 'right']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
})
const DocumentProps = z.object({
  fileId: z.string().max(64).optional(),
  url: SafeUrl.optional(),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  fileType: z.enum(['pdf', 'docx', 'xlsx', 'image', 'archive', 'other']).optional(),
  size: z.string().max(40).optional(),
  date: z.string().max(80).optional(),
  variant: z.enum(['card', 'inline', 'list']).optional(),
})
const StepsProps = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        title: z.string().max(200),
        description: z.string().max(1000),
        icon: z.string().max(40).optional(),
        status: z.enum(['todo', 'current', 'done']).optional(),
      })
    )
    .max(20),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  variant: z.enum(['numbered', 'icons', 'compact']).optional(),
})
const OrganismeProps = z.object({
  name: z.string().max(500),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(80).optional(),
  email: z.string().max(200).optional(),
  website: SafeUrl.optional(),
  hours: z.string().max(500).optional(),
  logo: SafeUrl.optional(),
  variant: z.enum(['card', 'compact', 'detailed']).optional(),
})
const GlossaryProps = z.object({
  title: z.string().max(500).optional(),
  items: z
    .array(z.object({ term: z.string().max(200), definition: z.string().max(2000) }))
    .max(500),
  variant: z.enum(['list', 'cards', 'alphabetical']).optional(),
})
const CounterProps = z.object({
  title: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        value: z.number(),
        label: z.string().max(200),
        prefix: z.string().max(20).optional(),
        suffix: z.string().max(20).optional(),
      })
    )
    .max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  duration: z.number().min(200).max(10000).optional(),
})
const CollectionProps = z.object({
  source: z.enum(['news', 'pages']),
  limit: z.number().min(1).max(50),
  category: z.string().max(120).optional(),
  layout: z.enum(['grid', 'list', 'carousel']),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
})
const FormProps = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  fields: z
    .array(
      z.object({
        type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']),
        name: z.string().max(80),
        label: z.string().max(200),
        placeholder: z.string().max(200).optional(),
        required: z.boolean().optional(),
        options: z.array(z.string().max(200)).max(50).optional(),
      })
    )
    .max(20),
  submitText: z.string().max(120),
  successMessage: z.string().max(500).optional(),
  endpoint: z.string().max(2048).optional(),
})

// ────────────────────────── Block discriminated union ──────────────────────────

const BLOCK_BASE = {
  id: z.string().min(1).max(64),
  style: StyleSchema.optional(),
  layout: LayoutSchema.optional(),
  advanced: AdvancedSchema.optional(),
  meta: MetaSchema.optional(),
  responsive: ResponsiveSchema.optional(),
  parentId: z.string().min(1).max(64).nullable().optional(),
  slotIndex: z.number().min(0).max(8).optional(),
}

/**
 * Permissive schema for any block — accepts any string `type` and any `props`.
 * Used as a fallback for the dozens of newer blocks where strict per-block
 * validation would be tedious. Type-safe blocks below take precedence.
 */
const PermissiveBlockSchema = z.object({
  ...BLOCK_BASE,
  type: z.string().min(1).max(40),
  props: z.record(z.string(), z.unknown()),
})

const StrictBlockSchema = z.discriminatedUnion('type', [
  z.object({ ...BLOCK_BASE, type: z.literal('heading'), props: HeadingProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('text'), props: TextProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('quote'), props: QuoteProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('divider'), props: DividerProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('spacer'), props: SpacerProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('image'), props: ImageProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('video'), props: VideoProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('gallery'), props: GalleryProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('embed'), props: EmbedProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('section'), props: SectionProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('container'), props: ContainerProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('columns'), props: ColumnsProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('hero'), props: HeroProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('features'), props: FeaturesProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('cta'), props: CtaProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('faq'), props: FaqProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('testimonial'), props: TestimonialProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('stats'), props: StatsProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('card'), props: CardProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('accordion'), props: AccordionProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('tabs'), props: TabsProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('alert'), props: AlertProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('badges'), props: BadgesProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('progress'), props: ProgressProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('buttonGroup'), props: ButtonGroupProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('document'), props: DocumentProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('steps'), props: StepsProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('organisme'), props: OrganismeProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('glossary'), props: GlossaryProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('counter'), props: CounterProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('collection'), props: CollectionProps }),
  z.object({ ...BLOCK_BASE, type: z.literal('form'), props: FormProps }),
])

/** Try strict validation first; fall back to permissive for new/unknown block types. */
export const BlockSchema = z.union([StrictBlockSchema, PermissiveBlockSchema])

export const BlocksSchema = z.array(BlockSchema).max(500)

const SlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'Slug invalide')

export const CreatePageSchema = z.object({
  title: z.string().min(1).max(200),
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
  return (
    title
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'page'
  )
}
