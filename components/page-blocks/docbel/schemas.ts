import { z } from 'zod'

export const documentSchema = z.object({
  fileId: z.string().max(64).optional(),
  url: z.string().max(4096).optional(),
  title: z.string().max(500).default(''),
  description: z.string().max(2000).optional(),
  fileType: z.enum(['pdf', 'docx', 'xlsx', 'image', 'archive', 'other']).optional(),
  size: z.string().max(40).optional(),
  date: z.string().max(120).optional(),
  variant: z.enum(['card', 'inline', 'list']).optional(),
})

const stepsItemSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  icon: z.string().max(40).optional(),
  status: z.enum(['todo', 'current', 'done']).optional(),
})

export const stepsSchema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  items: z.array(stepsItemSchema).max(20),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  variant: z.enum(['numbered', 'icons', 'compact']).optional(),
})

export const organismeSchema = z.object({
  name: z.string().max(200).default(''),
  description: z.string().max(2000).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(60).optional(),
  email: z.string().max(120).optional(),
  website: z.string().max(4096).optional(),
  hours: z.string().max(200).optional(),
  logo: z.string().max(4096).optional(),
  variant: z.enum(['card', 'compact', 'detailed']).optional(),
})

const glossaryItemSchema = z.object({
  term: z.string().max(200),
  definition: z.string().max(2000),
})

export const glossarySchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(glossaryItemSchema).max(200),
  variant: z.enum(['list', 'cards', 'alphabetical']).optional(),
})

const counterItemSchema = z.object({
  value: z.number(),
  label: z.string().max(200),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
})

export const counterSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(counterItemSchema).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  duration: z.number().min(100).max(10000).optional(),
})

export const collectionSchema = z.object({
  source: z.enum(['news', 'pages']),
  limit: z.number().min(1).max(20),
  category: z.string().max(120).optional(),
  layout: z.enum(['grid', 'list', 'carousel']),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

const formFieldDefSchema = z.object({
  type: z.enum(['text', 'email', 'tel', 'textarea', 'select', 'checkbox']),
  name: z.string().max(120),
  label: z.string().max(200),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().max(200)).optional(),
  pattern: z.string().max(300).optional(),
  minLength: z.number().min(0).max(5000).optional(),
  maxLength: z.number().min(1).max(5000).optional(),
  helpText: z.string().max(500).optional(),
})

export const formSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(formFieldDefSchema).max(30),
  submitText: z.string().max(120).default('Envoyer'),
  successMessage: z.string().max(500).optional(),
  endpoint: z.string().max(500).optional(),
})

export const docbelSchemas = {
  document: documentSchema,
  steps: stepsSchema,
  organisme: organismeSchema,
  glossary: glossarySchema,
  counter: counterSchema,
  collection: collectionSchema,
  form: formSchema,
} as const
