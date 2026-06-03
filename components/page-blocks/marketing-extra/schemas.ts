import { z } from 'zod'

export const pricingPlanSchema = z.object({
  name: z.string().max(120),
  price: z.string().max(40),
  period: z.string().max(40).optional(),
  description: z.string().max(500).optional(),
  features: z.array(z.string().max(500)),
  ctaText: z.string().max(120),
  ctaLink: z.string().max(4096),
  highlighted: z.boolean().optional(),
  badge: z.string().max(40).optional(),
})

export const pricingTableSchema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  plans: z.array(pricingPlanSchema).max(10),
  togglePeriod: z.boolean().optional(),
})

export const compareRowSchema = z.object({
  feature: z.string().max(500),
  values: z.array(z.union([z.string().max(500), z.boolean()])),
})

export const compareTableSchema = z.object({
  title: z.string().max(500).optional(),
  columns: z.array(z.string().max(120)),
  rows: z.array(compareRowSchema),
  highlightColumn: z.number().optional(),
})

export const countdownSchema = z.object({
  targetDate: z.string().default(''),
  title: z.string().max(500).optional(),
  variant: z.enum(['large', 'compact']).optional(),
  expiredMessage: z.string().max(500).optional(),
})

export const notificationBarSchema = z.object({
  message: z.string().max(2000).default(''),
  ctaText: z.string().max(120).optional(),
  ctaLink: z.string().max(4096).optional(),
  variant: z.enum(['info', 'success', 'warning', 'destructive']).optional(),
  dismissible: z.boolean().optional(),
})

export const newsletterSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  placeholder: z.string().max(120).optional(),
  buttonText: z.string().max(120).default('S\'inscrire'),
  endpoint: z.string().max(500).optional(),
  successMessage: z.string().max(500).optional(),
})

const trustBadgesItemSchema = z.object({
  icon: z.string().max(40).optional(),
  label: z.string().max(120),
})

export const trustBadgesSchema = z.object({
  badges: z.array(trustBadgesItemSchema).max(20),
  align: z.enum(['left', 'center']).optional(),
})

export const pressMentionsLogoSchema = z.object({
  url: z.string().max(4096),
  alt: z.string().max(200),
  href: z.string().max(4096).optional(),
})

export const pressMentionsSchema = z.object({
  title: z.string().max(500).optional(),
  logos: z.array(pressMentionsLogoSchema).max(20),
})

export const starRatingSchema = z.object({
  value: z.number().min(0).max(5).default(0),
  count: z.number().optional(),
  showCount: z.boolean().optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
})

export const leadMagnetSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  collectName: z.boolean().optional(),
  buttonText: z.string().max(120).default('Recevoir le document'),
  fileUrl: z.string().max(4096).optional(),
  fileName: z.string().max(200).optional(),
  successMessage: z.string().max(500).optional(),
  endpoint: z.string().max(4096).optional(),
})

export const exitIntentSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  ctaText: z.string().max(120).optional(),
  ctaLink: z.string().max(4096).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  oncePerSession: z.boolean().optional(),
})

export const marketingExtraSchemas = {
  exitIntent: exitIntentSchema,
  leadMagnet: leadMagnetSchema,
  pricingTable: pricingTableSchema,
  compareTable: compareTableSchema,
  countdown: countdownSchema,
  notificationBar: notificationBarSchema,
  newsletter: newsletterSchema,
  trustBadges: trustBadgesSchema,
  pressMentions: pressMentionsSchema,
  starRating: starRatingSchema,
} as const
