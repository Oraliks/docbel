import { z } from 'zod'

export const imageSchema = z.object({
  url: z.string().max(4096).default(''),
  alt: z.string().max(500).default(''),
  caption: z.string().max(500).optional(),
  ratio: z.enum(['auto', '1:1', '4:3', '16:9', '21:9']).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  rounded: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
})

export const videoSchema = z.object({
  url: z.string().max(2048).default(''),
  provider: z.enum(['youtube', 'vimeo', 'tiktok', 'dailymotion', 'loom', 'mp4']).default('youtube'),
  caption: z.string().max(500).optional(),
  autoplay: z.boolean().optional(),
  controls: z.boolean().optional(),
  fileId: z.string().max(64).optional(),
})

export const galleryItemSchema = z.object({
  url: z.string().max(4096),
  alt: z.string().max(500),
  caption: z.string().max(500).optional(),
})

export const gallerySchema = z.object({
  items: z.array(galleryItemSchema).max(50),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['grid', 'masonry']).optional(),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

export const embedSchema = z.object({
  html: z.string().max(20000).default(''),
  height: z.number().min(50).max(2000).optional(),
})

export const mediaSchemas = {
  image: imageSchema,
  video: videoSchema,
  gallery: gallerySchema,
  embed: embedSchema,
} as const
