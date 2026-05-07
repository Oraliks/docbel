'use client'

import React, { useEffect, useMemo } from 'react'
import { nanoid } from 'nanoid'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { BlockProps, BlockType, BlockPropsMap } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import { SidebarBlocks } from './sidebar-blocks'
import { CanvasEditor } from './canvas-editor'
import { PropertiesPanel } from './properties-panel'
import { toast } from 'sonner'

interface PageEditorProps {
  initialBlocks: BlockProps[]
}

export const PageEditor: React.FC<PageEditorProps> = ({ initialBlocks }) => {
  const blocks = usePageBuilderStore((s) => s.blocks)
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId)
  const setBlocks = usePageBuilderStore((s) => s.setBlocks)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)
  const addBlock = usePageBuilderStore((s) => s.addBlock)
  const removeBlock = usePageBuilderStore((s) => s.removeBlock)
  const updateBlock = usePageBuilderStore((s) => s.updateBlock)
  const duplicateBlock = usePageBuilderStore((s) => s.duplicateBlock)
  const moveBlock = usePageBuilderStore((s) => s.moveBlock)
  const reorderBlocks = usePageBuilderStore((s) => s.reorderBlocks)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    setBlocks(initialBlocks, { skipHistory: true })
  }, [initialBlocks, setBlocks])

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  )

  const handleAddBlock = (type: BlockType) => {
    const newBlock = {
      id: nanoid(),
      type,
      props: { ...BLOCK_REGISTRY[type].defaultProps } as BlockPropsMap[typeof type],
    } as BlockProps
    addBlock(newBlock)
    selectBlock(newBlock.id)
    toast.success(`${BLOCK_REGISTRY[type].name} ajouté`)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderBlocks(String(active.id), String(over.id))
  }

  const handleUpdateBlock = (props: Record<string, unknown>) => {
    if (!selectedBlockId) return
    updateBlock(selectedBlockId, props)
  }

  const handleDeleteBlock = (id: string) => {
    removeBlock(id)
    toast.success('Bloc supprimé')
  }

  return (
    <div className="flex h-full bg-background">
      <SidebarBlocks onAddBlock={handleAddBlock} />

      <div className="flex-1 overflow-auto">
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
          collisionDetection={closestCenter}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
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
