import { z } from 'zod'

export const quizQuestionSchema = z.object({
  question: z.string().max(2000),
  options: z.array(z.string().max(500)),
  correct: z.number(),
  explanation: z.string().max(2000).optional(),
})

const quizResultSchema = z.object({
  min: z.number(),
  message: z.string().max(2000),
})

export const quizSchema = z.object({
  title: z.string().max(500).optional(),
  questions: z.array(quizQuestionSchema).max(50),
  resultMessages: z.array(quizResultSchema).optional(),
})

export const pollOptionSchema = z.object({
  label: z.string().max(500),
  votes: z.number(),
})

export const pollSchema = z.object({
  question: z.string().max(2000).default(''),
  options: z.array(pollOptionSchema).max(50),
})

export const reactionsReactionSchema = z.object({
  emoji: z.string().max(10),
  label: z.string().max(60),
  count: z.number(),
})

export const reactionsSchema = z.object({
  reactions: z.array(reactionsReactionSchema).max(20),
})

const PLATFORMS = ['twitter', 'linkedin', 'facebook', 'email', 'whatsapp', 'copy'] as const

export const shareButtonsSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)),
  align: z.enum(['left', 'center', 'right']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  utmCampaign: z.string().max(120).optional(),
})

const calculatorOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
})

export const calculatorFieldSchema = z.object({
  name: z.string().max(60),
  label: z.string().max(200),
  type: z.enum(['number', 'select']),
  defaultValue: z.union([z.string(), z.number()]).optional(),
  unit: z.string().max(40).optional(),
  options: z.array(calculatorOptionSchema).optional(),
})

export const calculatorSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  fields: z.array(calculatorFieldSchema).max(20),
  formula: z.string().max(2000).default(''),
  resultLabel: z.string().max(200).default(''),
  resultUnit: z.string().max(40).optional(),
  resultPrecision: z.number().min(0).max(8).optional(),
})

export const engagementSchemas = {
  quiz: quizSchema,
  poll: pollSchema,
  reactions: reactionsSchema,
  shareButtons: shareButtonsSchema,
  calculator: calculatorSchema,
} as const
