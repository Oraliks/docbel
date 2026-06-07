import { z } from 'zod'

export const audioSchema = z.object({
  url: z.string().max(4096).optional(),
  fileId: z.string().max(64).optional(),
  title: z.string().max(200).optional(),
  artist: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
})

export const carouselSlideSchema = z.object({
  image: z.string().max(4096),
  alt: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  link: z.string().max(4096).optional(),
})

export const carouselSchema = z.object({
  slides: z.array(carouselSlideSchema).max(50),
  autoplay: z.boolean().optional(),
  interval: z.number().min(500).max(60000).optional(),
  showDots: z.boolean().optional(),
  showArrows: z.boolean().optional(),
})

export const beforeAfterSchema = z.object({
  beforeUrl: z.string().max(4096).default(''),
  afterUrl: z.string().max(4096).default(''),
  beforeLabel: z.string().max(120).optional(),
  afterLabel: z.string().max(120).optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
})

export const logoWallLogoSchema = z.object({
  url: z.string().max(4096),
  alt: z.string().max(200),
  href: z.string().max(4096).optional(),
})

export const logoWallSchema = z.object({
  title: z.string().max(500).optional(),
  logos: z.array(logoWallLogoSchema).max(50),
  variant: z.enum(['grid', 'marquee']).optional(),
  grayscale: z.boolean().optional(),
})

export const svgIllustrationSchema = z.object({
  svg: z.string().max(50000).default(''),
  width: z.string().max(40).optional(),
  height: z.string().max(40).optional(),
})

export const lottieSchema = z.object({
  src: z.string().max(4096).default(''),
  loop: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  speed: z.number().min(0.1).max(3).optional(),
})

export const mediaExtraSchemas = {
  audio: audioSchema,
  carousel: carouselSchema,
  beforeAfter: beforeAfterSchema,
  logoWall: logoWallSchema,
  svgIllustration: svgIllustrationSchema,
  lottie: lottieSchema,
} as const
