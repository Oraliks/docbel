import { z } from 'zod'
import { BLOCK_SCHEMAS } from './schema-registry'

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3,8})$/

const HexColor = z.string().regex(HEX_COLOR_REGEX).optional()

// État d'interaction (hover / focus / active / in-view) — schéma partagé.
const InteractionStateSchema = z
  .object({
    textColor: HexColor,
    bgColor: HexColor,
    borderColor: HexColor,
    opacity: z.number().min(0).max(1).optional(),
    scale: z.number().min(0.5).max(2).optional(),
    lift: z.number().min(0).max(40).optional(),
    shadow: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
  })
  .partial()

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
    bgGradientFrom: HexColor,
    bgGradientTo: HexColor,
    bgGradientAngle: z.number().min(0).max(360).optional(),
    bgImage: z.string().max(4096).optional(),
    bgImageSize: z.enum(['cover', 'contain', 'auto']).optional(),
    bgImagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
    bgOverlay: HexColor,
    bgOverlayOpacity: z.number().min(0).max(1).optional(),
    borderWidth: z.number().min(0).max(20).optional(),
    borderColor: HexColor,
    borderStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
    borderRadius: z.number().min(0).max(200).optional(),
    shadow: z.enum(['none', 'sm', 'md', 'lg', 'xl']).optional(),
    opacity: z.number().min(0).max(1).optional(),
    textEffect: z.enum(['none', 'gradient', 'shadow', 'glow', 'outline']).optional(),
    hoverState: InteractionStateSchema.optional(),
    focusState: InteractionStateSchema.optional(),
    activeState: InteractionStateSchema.optional(),
    inViewState: InteractionStateSchema.optional(),
    borderGradientFrom: HexColor,
    borderGradientTo: HexColor,
    borderGradientAngle: z.number().min(0).max(360).optional(),
    shadowColor: HexColor,
    shadowInset: z.boolean().optional(),
    clipPath: z
      .string()
      .max(300)
      .regex(/^[a-zA-Z0-9()%,.\s/_-]*$/)
      .optional(),
    mixBlendMode: z
      .enum([
        'normal',
        'multiply',
        'screen',
        'overlay',
        'darken',
        'lighten',
        'color-dodge',
        'soft-light',
        'difference',
        'luminosity',
      ])
      .optional(),
    backdropBlur: z.number().min(0).max(40).optional(),
  })
  .partial()

const LayoutSchema = z
  .object({
    width: z.string().max(40).optional(),
    maxWidth: z.string().max(40).optional(),
    height: z.string().max(40).optional(),
    minHeight: z.string().max(40).optional(),
    gridColumnSpan: z.number().min(1).max(6).optional(),
    sticky: z.boolean().optional(),
    stickyOffset: z.number().min(0).max(500).optional(),
    zIndex: z.number().min(0).max(1000).optional(),
    absolute: z.boolean().optional(),
    left: z.number().min(-2000).max(5000).optional(),
    top: z.number().min(-2000).max(5000).optional(),
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
      .enum([
        'none',
        'fade-in',
        'fade-up',
        'fade-down',
        'slide-left',
        'slide-right',
        'zoom-in',
        'zoom-out',
        'pulse',
        'bounce',
      ])
      .optional(),
    animationDelay: z.number().min(0).max(5000).optional(),
    animateOnScroll: z.boolean().optional(),
    parallax: z.number().min(-200).max(200).optional(),
    showIf: z.enum(['always', 'loggedIn', 'loggedOut']).optional(),
    conditions: z
      .array(
        z.object({
          type: z.enum(['param', 'lang']),
          key: z.string().max(60).optional(),
          op: z.enum(['eq', 'neq', 'contains', 'exists']),
          value: z.string().max(200).optional(),
        })
      )
      .max(10)
      .optional(),
    customCss: z.string().max(4000).optional(),
    scheduleStart: z.string().max(40).optional(),
    scheduleEnd: z.string().max(40).optional(),
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
 * Used as a fallback for unknown / legacy block types so older saved pages keep
 * loading even if a block type was renamed or removed. Strict (registry-derived)
 * variants below take precedence.
 */
const PermissiveBlockSchema = z.object({
  ...BLOCK_BASE,
  type: z.string().min(1).max(40),
  props: z.record(z.string(), z.unknown()),
})

/**
 * Strict block variants are GENERATED from the block registry: one variant per
 * registered block type, deriving its `props` schema from the block's own Zod
 * schema — the single source of truth co-located with the block component.
 *
 * This replaces ~280 lines of hand-maintained per-block schemas that duplicated
 * (and drifted from) the block files, and now covers EVERY block instead of a
 * hand-picked subset. See lib/page-builder/schema-registry.ts.
 */
const blockVariants = Object.entries(BLOCK_SCHEMAS).map(([type, props]) =>
  z.object({ ...BLOCK_BASE, type: z.literal(type), props })
)

const StrictBlockSchema = z.discriminatedUnion(
  'type',
  blockVariants as [(typeof blockVariants)[number], ...(typeof blockVariants)[number][]]
)

/** Try strict (per-type) validation first; fall back to permissive for unknown types. */
export const BlockSchema = z.union([StrictBlockSchema, PermissiveBlockSchema])

export const BlocksSchema = z.array(BlockSchema).max(500)

/** Bloc validé par la variante STRICTE (registry-derived) — sans fallback permissif. */
export type StrictValidatedBlock = z.infer<typeof StrictBlockSchema>

/**
 * Valide des blocs PRODUITS PAR L'IA avec la variante STRICTE uniquement
 * (registry-derived), JAMAIS le fallback permissif. Pensé pour les sorties des
 * routes IA du page-builder (`ai-generate`, `ai-copilot`) : un modèle ne doit
 * pouvoir insérer que des blocs dont la forme correspond EXACTEMENT au schéma du
 * type, contrairement au chargement legacy qui tolère des types inconnus.
 *
 * - Chaque bloc est validé INDIVIDUELLEMENT : un bloc malformé est ÉCARTÉ (pas
 *   renvoyé), il ne fait pas échouer les blocs valides voisins.
 * - Si `allowedTypes` est fourni, seuls les blocs de ces types sont conservés
 *   (whitelist appliquée AVANT la validation de forme).
 * - Renvoie le tableau (éventuellement vide) des blocs valides, props normalisées
 *   par leurs schémas (defaults appliqués), comme `BlocksSchema` le ferait.
 *
 * N'altère PAS `BlockSchema` / `BlocksSchema` (chargement legacy permissif).
 */
export function validateAiBlocks(
  data: unknown,
  allowedTypes?: string[]
): StrictValidatedBlock[] {
  if (!Array.isArray(data)) return []
  const allow = allowedTypes ? new Set(allowedTypes) : null

  const valid: StrictValidatedBlock[] = []
  for (const candidate of data) {
    // Whitelist de type appliquée avant la validation de forme.
    if (allow) {
      const type = (candidate as { type?: unknown } | null)?.type
      if (typeof type !== 'string' || !allow.has(type)) continue
    }
    const result = StrictBlockSchema.safeParse(candidate)
    if (result.success) valid.push(result.data)
  }
  return valid
}

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

const ThemeTokensSchema = z.object({
  primary: z.string().max(40).optional(),
  secondary: z.string().max(40).optional(),
  accent: z.string().max(40).optional(),
  background: z.string().max(40).optional(),
  foreground: z.string().max(40).optional(),
  muted: z.string().max(40).optional(),
  border: z.string().max(40).optional(),
  fontFamily: z.string().max(120).optional(),
  radius: z.number().min(0).max(64).optional(),
}).strict()

export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: SlugSchema.optional(),
  content: BlocksSchema.optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  metaTitle: NullableTrimmedString(60),
  metaDesc: NullableTrimmedString(160),
  ogImage: z
    .union([z.literal(''), z.string().url().max(2048)])
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  themeTokens: ThemeTokensSchema.nullable().optional(),
  variables: z
    .array(
      z.object({
        key: z
          .string()
          .max(40)
          .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Clé invalide (lettres, chiffres, _)'),
        value: z.string().max(2000),
      })
    )
    .max(50)
    .nullable()
    .optional(),
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
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'page'
  )
}
