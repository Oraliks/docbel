import React from 'react'
import {
  BlockProps,
  CtaProps,
  FeaturesProps,
  HeroProps,
  ImageProps,
  SectionProps,
} from '@/lib/page-builder/types'
import { HeroBlock } from '@/components/page-blocks/hero-block'
import { CtaBlock } from '@/components/page-blocks/cta-block'
import { ImageBlock } from '@/components/page-blocks/image-block'
import { FeaturesBlock } from '@/components/page-blocks/features-block'
import { SectionBlock } from '@/components/page-blocks/section-block'

interface PageRendererProps {
  blocks: BlockProps[]
}

function BlockItem({ block }: { block: BlockProps }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock key={block.id} {...(block.props as unknown as HeroProps)} />
    case 'cta':
      return <CtaBlock key={block.id} {...(block.props as unknown as CtaProps)} />
    case 'image':
      return <ImageBlock key={block.id} {...(block.props as unknown as ImageProps)} />
    case 'features':
      return <FeaturesBlock key={block.id} {...(block.props as unknown as FeaturesProps)} />
    case 'section':
      return <SectionBlock key={block.id} {...(block.props as unknown as SectionProps)} />
    default:
      return null
  }
}

class BlockItemErrorBoundary extends React.Component<
  { block: BlockProps },
  { hasError: boolean }
> {
  constructor(props: { block: BlockProps }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(`Error rendering block ${this.props.block.id}:`, error)
  }

  render() {
    if (this.state.hasError) return null
    return <BlockItem block={this.props.block} />
  }
}

export const PageRenderer: React.FC<PageRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return <div className="text-center text-gray-500 py-12">Pas de contenu</div>
  }

  return (
    <div className="space-y-0">
      {blocks.map((block) => (
        <BlockItemErrorBoundary key={block.id} block={block} />
      ))}
    </div>
  )
}
