import React from 'react'
import { BlockProps } from '@/lib/page-builder/types'
import { HeroBlock } from '@/components/page-blocks/hero-block'
import { CtaBlock } from '@/components/page-blocks/cta-block'
import { ImageBlock } from '@/components/page-blocks/image-block'
import { FeaturesBlock } from '@/components/page-blocks/features-block'
import { SectionBlock } from '@/components/page-blocks/section-block'

interface PageRendererProps {
  blocks: BlockProps[]
}

export const PageRenderer: React.FC<PageRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return <div className="text-center text-gray-500 py-12">Pas de contenu</div>
  }

  return (
    <div className="space-y-0">
      {blocks.map((block) => {
        try {
          switch (block.type) {
            case 'hero':
              return <HeroBlock key={block.id} {...(block.props as any)} />
            case 'cta':
              return <CtaBlock key={block.id} {...(block.props as any)} />
            case 'image':
              return <ImageBlock key={block.id} {...(block.props as any)} />
            case 'features':
              return <FeaturesBlock key={block.id} {...(block.props as any)} />
            case 'section':
              return <SectionBlock key={block.id} {...(block.props as any)} />
            default:
              console.warn(`Unknown block type: ${block.type}`)
              return null
          }
        } catch (error) {
          console.error(`Error rendering block ${block.id}:`, error)
          return null
        }
      })}
    </div>
  )
}
