import { z } from 'zod'

export const articleHeaderSchema = z.object({
  category: z.string().max(120).optional(),
  title: z.string().max(500).default(''),
  excerpt: z.string().max(2000).optional(),
  authorName: z.string().max(200).optional(),
  authorAvatar: z.string().max(4096).optional(),
  date: z.string().optional(),
  readingTime: z.number().optional(),
  image: z.string().max(4096).optional(),
})

export const authorBioSchema = z.object({
  name: z.string().max(200).default(''),
  bio: z.string().max(2000).optional(),
  avatar: z.string().max(4096).optional(),
  twitter: z.string().max(4096).optional(),
  linkedin: z.string().max(4096).optional(),
  website: z.string().max(4096).optional(),
  email: z.string().max(200).optional(),
})

export const sponsoredDisclosureSchema = z.object({
  sponsor: z.string().max(200).optional(),
})

export const editorialSchemas = {
  articleHeader: articleHeaderSchema,
  authorBio: authorBioSchema,
  sponsoredDisclosure: sponsoredDisclosureSchema,
} as const
