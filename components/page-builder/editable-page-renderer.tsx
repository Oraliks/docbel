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
import { EditablePreviewBlock } from './editable-preview-block'
import { EditableHeroBlock } from '@/components/page-blocks/editable-hero-block'
import { EditableCtaBlock } from '@/components/page-blocks/editable-cta-block'
import { ImageBlock } from '@/components/page-blocks/image-block'
import { FeaturesBlock } from '@/components/page-blocks/features-block'
import { SectionBlock } from '@/components/page-blocks/section-block'

interface EditablePageRendererProps {
  blocks: BlockProps[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onUpdateBlock: (id: string, props: Record<string, unknown>) => void
  onDuplicateBlock: (id: string) => void
  onDeleteBlock: (id: string) => void
  onMoveBlockUp: (id: string) => void
  onMoveBlockDown: (id: string) => void
  onAddBlockAfter: (id: string, type: 'hero' | 'cta' | 'image' | 'features' | 'section') => void
}

export const EditablePageRenderer: React.FC<EditablePageRendererProps> = ({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onAddBlockAfter,
}) => {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const isSelected = block.id === selectedBlockId

        let blockComponent: React.ReactNode
        switch (block.type) {
          case 'hero': {
            const heroProps = block.props as unknown as HeroProps
            blockComponent = (
              <EditableHeroBlock
                {...heroProps}
                isSelected={isSelected}
                onEdit={(props) => onUpdateBlock(block.id, props as unknown as Record<string, unknown>)}
              />
            )
            break
          }
          case 'cta': {
            const ctaProps = block.props as unknown as CtaProps
            blockComponent = (
              <EditableCtaBlock
                {...ctaProps}
                isSelected={isSelected}
                onEdit={(props) => onUpdateBlock(block.id, props as unknown as Record<string, unknown>)}
              />
            )
            break
          }
          case 'image': {
            const imageProps = block.props as unknown as ImageProps
            blockComponent = (
              <ImageBlock {...imageProps} />
            )
            break
          }
          case 'features': {
            const featuresProps = block.props as unknown as FeaturesProps
            blockComponent = (
              <FeaturesBlock {...featuresProps} />
            )
            break
          }
          case 'section': {
            const sectionProps = block.props as unknown as SectionProps
            blockComponent = (
              <SectionBlock {...sectionProps} />
            )
            break
          }
          default:
            blockComponent = null
        }

        return (
          <EditablePreviewBlock
            key={block.id}
            block={block}
            isSelected={isSelected}
            onSelect={() => onSelectBlock(block.id)}
            onEdit={(props) => onUpdateBlock(block.id, props)}
            onDuplicate={() => onDuplicateBlock(block.id)}
            onDelete={() => onDeleteBlock(block.id)}
            onMoveUp={index > 0 ? () => onMoveBlockUp(block.id) : undefined}
            onMoveDown={index < blocks.length - 1 ? () => onMoveBlockDown(block.id) : undefined}
            onAddBlockAfter={() => {
              // Show a quick menu to select block type
              // For now, we'll just add a CTA block
              onAddBlockAfter(block.id, 'cta')
            }}
          >
            {blockComponent}
          </EditablePreviewBlock>
        )
      })}
    </div>
  )
}
