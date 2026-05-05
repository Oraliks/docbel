export type BlockType = 'hero' | 'cta' | 'image' | 'features' | 'section'

export interface BlockProps {
  id: string
  type: BlockType
  props: Record<string, unknown>
}

export interface PageData {
  id: string
  title: string
  slug: string
  status: string
  blocks: BlockProps[]
  createdAt: Date
  updatedAt: Date
}

export interface HeroProps {
  title: string
  description: string
  bgColor?: string
  image?: string
}

export interface CtaProps {
  text: string
  link: string
  variant: 'primary' | 'secondary'
}

export interface ImageProps {
  url: string
  alt: string
  caption?: string
  width?: string
  height?: string
}

export interface FeaturesProps {
  title?: string
  items: Array<{
    icon?: string
    title: string
    description: string
  }>
}

export interface SectionProps {
  title?: string
  description?: string
  bgColor?: string
  padding?: 'small' | 'medium' | 'large'
}
