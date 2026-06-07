import { z } from 'zod'

// Disposition des enfants (Flex/Grid) — partagée par section & container.
const childLayoutShape = {
  layoutMode: z.enum(['stack', 'row', 'grid', 'autogrid', 'masonry']).optional(),
  layoutGap: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
  layoutJustify: z.enum(['start', 'center', 'end', 'between', 'around']).optional(),
  layoutAlign: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  layoutCols: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  layoutMinItem: z.enum(['sm', 'md', 'lg']).optional(),
  layoutWrap: z.boolean().optional(),
  freeLayout: z.boolean().optional(),
}

export const sectionSchema = z.object({
  bgType: z.enum(['none', 'color', 'gradient', 'image']).optional(),
  bgColor: z.string().optional(),
  bgGradient: z.string().max(500).optional(),
  bgImage: z.string().max(4096).optional(),
  bgOverlay: z.string().optional(),
  fullWidth: z.boolean().optional(),
  ...childLayoutShape,
})

export const containerSchema = z.object({
  width: z.enum(['sm', 'md', 'lg', 'xl', 'full']).optional(),
  ...childLayoutShape,
})

export const columnsSchema = z.object({
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
  ratio: z
    .enum(['equal', '1-2', '2-1', '1-3', '3-1', '1-1-2', '1-2-1', '2-1-1'])
    .optional(),
  vAlign: z.enum(['start', 'center', 'stretch']).optional(),
  reverseMobile: z.boolean().optional(),
})

export const repeaterSchema = z.object({
  items: z
    .array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])))
    .max(200)
    .optional(),
  emptyText: z.string().max(200).optional(),
  ...childLayoutShape,
})

export const layoutSchemas = {
  section: sectionSchema,
  container: containerSchema,
  columns: columnsSchema,
  repeater: repeaterSchema,
} as const
