'use client'

import React from 'react'
import { BlockProps } from '@/lib/page-builder/types'
import { HeroBlock } from '@/components/page-blocks/hero-block'
import { CtaBlock } from '@/components/page-blocks/cta-block'
import { ImageBlock } from '@/components/page-blocks/image-block'
import { FeaturesBlock } from '@/components/page-blocks/features-block'
import { SectionBlock } from '@/components/page-blocks/section-block'
import { Card } from '@/components/ui/card'

interface BlockPreviewProps {
  block: BlockProps
}

export function BlockPreview({ block }: BlockPreviewProps) {
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
        return (
          <Card className="p-4 text-center text-muted-foreground">
            Type inconnu: {block.type}
          </Card>
        )
    }
  } catch (error) {
    return (
      <Card className="p-4 text-center text-red-600">
        Erreur rendu: {String(error)}
      </Card>
    )
  }
}
