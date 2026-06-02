import { z } from 'zod'

export const gdprNoticeSchema = z.object({
  message: z.string().max(2000).default(''),
  acceptText: z.string().max(120).default('Accepter'),
  declineText: z.string().max(120).optional(),
  link: z.string().max(4096).optional(),
  linkText: z.string().max(120).optional(),
})

export const mapEmbedSchema = z.object({
  query: z.string().max(500).default(''),
  zoom: z.number().min(1).max(19).optional(),
  height: z.number().min(50).max(2000).optional(),
  caption: z.string().max(500).optional(),
})

export const tiltCardSchema = z.object({
  title: z.string().max(500).default(''),
  description: z.string().max(2000).optional(),
  image: z.string().max(4096).optional(),
  link: z.string().max(4096).optional(),
})

export const imageHotspotsHotspotSchema = z.object({
  x: z.number(),
  y: z.number(),
  title: z.string().max(200),
  description: z.string().max(2000),
})

export const imageHotspotsSchema = z.object({
  image: z.string().max(4096).default(''),
  alt: z.string().max(500).optional(),
  hotspots: z.array(imageHotspotsHotspotSchema).max(20),
})

export const marqueeSchema = z.object({
  text: z.string().max(2000).default(''),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  reverse: z.boolean().optional(),
  color: z.string().optional(),
})

export const customCssSchema = z.object({ css: z.string().max(50000).default('') })

export const htmlRawSchema = z.object({ html: z.string().max(50000).default('') })

export const utilitySchemas = {
  gdprNotice: gdprNoticeSchema,
  mapEmbed: mapEmbedSchema,
  tiltCard: tiltCardSchema,
  imageHotspots: imageHotspotsSchema,
  marquee: marqueeSchema,
  customCss: customCssSchema,
  htmlRaw: htmlRawSchema,
} as const
