import { z } from 'zod'
import { actionSchema } from '@/lib/page-builder/action-schema'

export const heroSchema = z.object({
  title: z.string().max(500).default(''),
  subtitle: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  ctaText: z.string().max(120).optional(),
  ctaLink: z.string().max(4096).optional(),
  ctaSecondaryText: z.string().max(120).optional(),
  ctaSecondaryLink: z.string().max(4096).optional(),
  image: z.string().max(4096).optional(),
  bgColor: z.string().optional(),
  variant: z.enum(['centered', 'split', 'minimal', 'fullbleed']).optional(),
})

const featuresItemSchema = z.object({
  icon: z.string().max(40).optional(),
  title: z.string().max(200),
  description: z.string().max(1000),
})

export const featuresSchema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z.array(featuresItemSchema).max(24),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['cards', 'icons', 'centered']).optional(),
})

export const ctaSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  text: z.string().max(120).default(''),
  link: z.string().max(4096).default(''),
  secondaryText: z.string().max(120).optional(),
  secondaryLink: z.string().max(4096).optional(),
  variant: z.enum(['inline', 'banner', 'card']).optional(),
  buttonStyle: z.enum(['primary', 'secondary', 'outline', 'ghost']).optional(),
  buttonSize: z.enum(['sm', 'md', 'lg']).optional(),
  action: actionSchema.optional(),
  secondaryAction: actionSchema.optional(),
})

const faqItemSchema = z.object({
  question: z.string().max(500),
  answer: z.string().max(2000),
})

export const faqSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(faqItemSchema).max(50),
  variant: z.enum(['simple', 'bordered', 'card']).optional(),
})

const testimonialItemSchema = z.object({
  quote: z.string().max(2000),
  author: z.string().max(200),
  role: z.string().max(200).optional(),
  avatar: z.string().max(4096).optional(),
})

export const testimonialSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(testimonialItemSchema).max(20),
  variant: z.enum(['single', 'grid', 'carousel']).optional(),
})

const statsItemSchema = z.object({
  value: z.string().max(40),
  label: z.string().max(200),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
})

export const statsSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(statsItemSchema).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['simple', 'cards', 'centered']).optional(),
})

export const marketingSchemas = {
  hero: heroSchema,
  features: featuresSchema,
  cta: ctaSchema,
  faq: faqSchema,
  testimonial: testimonialSchema,
  stats: statsSchema,
} as const
