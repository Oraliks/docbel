export type BlockType = 'hero' | 'cta' | 'image' | 'features' | 'section'

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

export interface FeaturesItem {
  icon?: string
  title: string
  description: string
}

export interface FeaturesProps {
  title?: string
  items: FeaturesItem[]
}

export interface SectionProps {
  title?: string
  description?: string
  bgColor?: string
  padding?: 'small' | 'medium' | 'large'
}

export type BlockPropsMap = {
  hero: HeroProps
  cta: CtaProps
  image: ImageProps
  features: FeaturesProps
  section: SectionProps
}

export type Block<T extends BlockType = BlockType> = {
  [K in BlockType]: { id: string; type: K; props: BlockPropsMap[K] }
}[T]

export type BlockProps = Block

export interface PageData {
  id: string
  title: string
  slug: string
  status: string
  blocks?: BlockProps[]
  metaTitle?: string | null
  metaDesc?: string | null
  ogImage?: string | null
  createdAt: Date
  updatedAt: Date
}
