'use client'

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
import { Card } from '@/components/ui/card'

interface BlockPreviewProps {
  block: BlockProps
}

function BlockContent({ block }: BlockPreviewProps) {
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
      return (
        <Card className="p-4 text-center text-muted-foreground">
          Type inconnu: {block.type}
        </Card>
      )
  }
}

class BlockErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: String(error) }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-4 text-center text-red-600">
          Erreur rendu: {this.state.error}
        </Card>
      )
    }
    return this.props.children
  }
}

export function BlockPreview({ block }: BlockPreviewProps) {
  return (
    <BlockErrorBoundary>
      <BlockContent block={block} />
    </BlockErrorBoundary>
  )
}
