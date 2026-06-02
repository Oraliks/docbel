import { z } from 'zod'

export const belgianDateHelperSchema = z.object({
  startDate: z.string().default(''),
  daysToAdd: z.number().default(30),
  countWeekendsAndHolidays: z.enum(['businessOnly', 'all']).default('businessOnly'),
  label: z.string().max(200).optional(),
})

const tarifsTableRowSchema = z.object({
  situation: z.string().max(500),
  montant: z.string().max(120),
  periode: z.string().max(60).optional(),
  remarque: z.string().max(500).optional(),
})

export const tarifsTableSchema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional(),
  rows: z.array(tarifsTableRowSchema).max(50),
  source: z.string().max(200).optional(),
})

const eligibilityTestQuestionSchema = z.object({
  question: z.string().max(2000),
  type: z.enum(['yesno', 'select']),
  options: z.array(z.string()).optional(),
})

export const eligibilityTestSchema = z.object({
  title: z.string().max(500).optional(),
  introText: z.string().max(2000).optional(),
  questions: z.array(eligibilityTestQuestionSchema).max(50),
  rules: z.object({
    allYes: z.boolean().optional(),
    minYes: z.number().optional(),
    resultIfPass: z.string().max(2000),
    resultIfFail: z.string().max(2000),
  }),
})

export const lawCitationSchema = z.object({
  reference: z.string().max(500).default(''),
  text: z.string().max(5000).default(''),
  source: z.string().max(200).optional(),
  link: z.string().max(4096).optional(),
})

export const casePracticeSchema = z.object({
  title: z.string().max(500).default(''),
  situation: z.string().max(2000).default(''),
  steps: z.array(z.string().max(1000)),
  outcome: z.string().max(1000).optional(),
})

const requiredDocsDocSchema = z.object({
  name: z.string().max(500),
  description: z.string().max(1000).optional(),
  required: z.boolean().optional(),
})

export const requiredDocsSchema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(requiredDocsDocSchema).max(50),
})

export const legalDelaySchema = z.object({
  delay: z.string().max(120).default(''),
  context: z.string().max(500).default(''),
  variant: z.enum(['large', 'inline']).optional(),
})

export const docbelExtraSchemas = {
  belgianDateHelper: belgianDateHelperSchema,
  tarifsTable: tarifsTableSchema,
  eligibilityTest: eligibilityTestSchema,
  lawCitation: lawCitationSchema,
  casePractice: casePracticeSchema,
  requiredDocs: requiredDocsSchema,
  legalDelay: legalDelaySchema,
} as const
