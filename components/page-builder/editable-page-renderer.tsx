'use client'

import React from 'react'
import { BlockProps } from '@/lib/page-builder/types'
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
  onUpdateBlock: (id: string, props: any) => void
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
          case 'hero':
            blockComponent = (
              <EditableHeroBlock
                title={block.props.title}
                description={block.props.description}
                bgColor={block.props.bgColor}
                image={block.props.image}
                isSelected={isSelected}
                onEdit={(props) => onUpdateBlock(block.id, props)}
              />
            )
            break
          case 'cta':
            blockComponent = (
              <EditableCtaBlock
                text={block.props.text}
                link={block.props.link}
                variant={block.props.variant}
                isSelected={isSelected}
                onEdit={(props) => onUpdateBlock(block.id, props)}
              />
            )
            break
          case 'image':
            blockComponent = (
              <ImageBlock
                url={block.props.url}
                alt={block.props.alt}
                caption={block.props.caption}
                width={block.props.width}
                height={block.props.height}
              />
            )
            break
          case 'features':
            blockComponent = (
              <FeaturesBlock
                title={block.props.title}
                items={block.props.items}
              />
            )
            break
          case 'section':
            blockComponent = (
              <SectionBlock
                title={block.props.title}
                description={block.props.description}
                bgColor={block.props.bgColor}
                padding={block.props.padding}
              />
            )
            break
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
