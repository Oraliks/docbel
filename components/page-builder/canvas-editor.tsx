'use client'

import React from 'react'
import { BlockProps } from '@/lib/page-builder/types'
import { SortableBlock } from './sortable-block'
import { BlockPreview } from './block-preview'
import { Card } from '@/components/ui/card'

interface CanvasEditorProps {
  blocks: BlockProps[]
  selectedBlockId: string | null
  onSelectBlock: (id: string) => void
  onDeleteBlock: (id: string) => void
  onDuplicateBlock: (id: string) => void
  onMoveBlock: (id: string, direction: 'up' | 'down') => void
}

export function CanvasEditor({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlock,
}: CanvasEditorProps) {
  return (
    <div className="grid grid-cols-2 h-full">
      {/* Left: Edit */}
      <div className="overflow-auto p-6 border-r">
        {blocks.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            Aucun bloc. Ajoute-en un.
          </Card>
        ) : (
          <div className="space-y-4">
            {blocks.map((block, idx) => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={block.id === selectedBlockId}
                onSelect={() => onSelectBlock(block.id)}
                onDuplicate={() => onDuplicateBlock(block.id)}
                onDelete={() => onDeleteBlock(block.id)}
                onMoveUp={idx > 0 ? () => onMoveBlock(block.id, 'up') : undefined}
                onMoveDown={idx < blocks.length - 1 ? () => onMoveBlock(block.id, 'down') : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="overflow-auto p-6 bg-muted/50">
        <div className="space-y-6">
          {blocks.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              Aperçu des blocs
            </div>
          ) : (
            blocks.map((block) => (
              <div key={block.id}>
                <BlockPreview block={block} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
