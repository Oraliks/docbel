'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BlockProps } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'

const getBlockIcon = (iconName: string) => {
  const icons: Record<string, React.ReactNode> = {
    'zap': '⚡',
    'file-text': '📝',
    'mouse-pointer': '🖱️',
  }
  return icons[iconName] || '📦'
}

const getPreview = (block: BlockProps): string => {
  switch (block.type) {
    case 'hero':
      return block.props.title || '(sans titre)'
    case 'cta':
      return block.props.text || '(sans texte)'
    case 'image':
      return block.props.url ? '(image chargée)' : '(image non configurée)'
    case 'features':
      return `${block.props.items?.length || 0} fonctionnalités`
    case 'section':
      return block.props.title || '(sans titre)'
    default:
      return '?'
  }
}

interface SortableBlockProps {
  block: BlockProps
  isSelected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export const SortableBlock: React.FC<SortableBlockProps> = ({
  block,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-2 cursor-pointer transition ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
      } ${isDragging ? 'shadow-lg z-50' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 group/drag relative"
          title="Glissez pour réordonner"
        >
          <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/drag:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            Glissez pour réordonner
          </div>
        </div>

        {/* Block Icon with Tooltip */}
        {BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY] ? (
          <span
            className="text-lg flex-shrink-0 cursor-help group/icon relative"
            title={BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY].name}
          >
            {getBlockIcon(BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY].iconName)}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/icon:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              {BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY].name}
            </div>
          </span>
        ) : (
          <span
            className="text-lg flex-shrink-0 cursor-help group/icon relative text-gray-400"
            title="Type de bloc inconnu"
          >
            ❓
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/icon:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              Type inconnu: {block.type}
            </div>
          </span>
        )}

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0 ml-auto">
          {onMoveUp && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onMoveUp() }}>
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onMoveDown() }}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onDuplicate() }}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
