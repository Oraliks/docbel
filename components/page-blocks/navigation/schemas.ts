import { z } from 'zod'

export const openingHoursDaySchema = z.object({
  day: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
})

export const openingHoursSchema = z.object({
  title: z.string().max(500).optional(),
  schedule: z.array(openingHoursDaySchema),
  showCurrentStatus: z.boolean().optional(),
})

export const lastUpdatedSchema = z.object({
  date: z.string().optional(),
  format: z.enum(['long', 'short', 'relative']).optional(),
  prefix: z.string().max(120).optional(),
})

export const tableOfContentsSchema = z.object({
  title: z.string().max(200).optional(),
  sticky: z.boolean().optional(),
  maxLevel: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

export const anchorMenuItemSchema = z.object({
  label: z.string().max(120),
  anchor: z.string().max(120),
})

export const anchorMenuSchema = z.object({
  items: z.array(anchorMenuItemSchema).max(20),
  sticky: z.boolean().optional(),
})

export const backToTopSchema = z.object({
  threshold: z.number().min(0).max(10000).optional(),
})

export const readingProgressSchema = z.object({
  color: z.string().optional(),
  height: z.number().min(1).max(20).optional(),
})

export const navigationSchemas = {
  openingHours: openingHoursSchema,
  lastUpdated: lastUpdatedSchema,
  tableOfContents: tableOfContentsSchema,
  anchorMenu: anchorMenuSchema,
  backToTop: backToTopSchema,
  readingProgress: readingProgressSchema,
} as const
