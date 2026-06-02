import { z } from 'zod'

export const codeBlockSchema = z.object({
  code: z.string().max(50000).default(''),
  language: z.string().max(40).optional(),
  filename: z.string().max(120).optional(),
  showLineNumbers: z.boolean().optional(),
})

export const pullQuoteSchema = z.object({
  text: z.string().max(2000).default(''),
  author: z.string().max(200).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

export const definitionListItemSchema = z.object({
  term: z.string().max(200),
  definition: z.string().max(2000),
})

export const definitionListSchema = z.object({
  items: z.array(definitionListItemSchema).max(100),
})

export const highlightSchema = z.object({
  text: z.string().max(2000).default(''),
  color: z.enum(['yellow', 'green', 'pink', 'blue', 'orange']).optional(),
})

export const prosConsSchema = z.object({
  pros: z.array(z.string().max(500)).max(50),
  cons: z.array(z.string().max(500)).max(50),
  prosTitle: z.string().max(120).optional(),
  consTitle: z.string().max(120).optional(),
})

export const checklistItemSchema = z.object({
  text: z.string().max(500),
  checked: z.boolean().optional(),
})

export const checklistSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(checklistItemSchema).max(100),
  interactive: z.boolean().optional(),
})

export const dropCapSchema = z.object({
  html: z.string().max(20000).default(''),
  capColor: z.string().optional(),
})

export const textExtraSchemas = {
  codeBlock: codeBlockSchema,
  pullQuote: pullQuoteSchema,
  dropCap: dropCapSchema,
  definitionList: definitionListSchema,
  highlight: highlightSchema,
  prosCons: prosConsSchema,
  checklist: checklistSchema,
} as const
