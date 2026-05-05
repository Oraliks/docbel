'use client'

import React, { useEffect, useRef } from 'react'
import { nanoid } from 'nanoid'
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { BlockProps, BlockType } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import { SidebarBlocks } from './sidebar-blocks'
import { CanvasEditor } from './canvas-editor'
import { PropertiesPanel } from './properties-panel'
import { toast } from 'sonner'

interface PageEditorProps {
  initialBlocks: BlockProps[]
  onSave: (blocks: BlockProps[]) => Promise<void>
  onQuit?: () => void
}

export const PageEditor: React.FC<PageEditorProps> = ({
  initialBlocks,
  onSave,
}) => {
  const { blocks, setBlocks, selectedBlockId, selectBlock, addBlock, removeBlock, updateBlock, duplicateBlock, moveBlock } = usePageBuilderStore()
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const onSaveRef = useRef(onSave)

  useEffect(() => {
    onSaveRef.current = onSave
    setBlocks(initialBlocks)
  }, [initialBlocks, onSave, setBlocks])

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null

  const handleAddBlock = (type: BlockType) => {
    const newBlock: BlockProps = {
      id: nanoid(),
      type,
      props: BLOCK_REGISTRY[type].defaultProps,
    }
    addBlock(newBlock)
    selectBlock(newBlock.id)
    toast.success(`${BLOCK_REGISTRY[type].name} ajouté`)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newBlocks = [...blocks]
    ;[newBlocks[oldIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[oldIndex]]
    setBlocks(newBlocks)
    autoSave(newBlocks)
  }

  const autoSave = (blocksToSave: BlockProps[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      onSaveRef.current(blocksToSave).catch(() => toast.error('Erreur de sauvegarde'))
    }, 1000)
  }

  const handleUpdateBlock = (props: Record<string, unknown>) => {
    if (!selectedBlockId) return
    updateBlock(selectedBlockId, props)
    autoSave(blocks.map((b) => b.id === selectedBlockId ? { ...b, props: { ...b.props, ...props } } : b))
  }

  const handleDeleteBlock = (id: string) => {
    removeBlock(id)
    autoSave(blocks.filter((b) => b.id !== id))
    toast.success('Bloc supprimé')
  }

  return (
    <div className="flex h-full bg-background">
      <SidebarBlocks onAddBlock={handleAddBlock} />

      <div className="flex-1 overflow-auto">
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <CanvasEditor
              blocks={blocks}
              selectedBlockId={selectedBlockId}
              onSelectBlock={selectBlock}
              onDeleteBlock={handleDeleteBlock}
              onDuplicateBlock={duplicateBlock}
              onMoveBlock={moveBlock}
            />
          </SortableContext>
        </DndContext>
      </div>

      {selectedBlock && (
        <PropertiesPanel block={selectedBlock} onChange={handleUpdateBlock} />
      )}
    </div>
  )
}
