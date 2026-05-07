'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BlockProps,
  CtaProps,
  FeaturesProps,
  HeroProps,
  ImageProps,
  SectionProps,
} from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/block-registry'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Box,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  GripVertical,
  MousePointer,
  Trash2,
  Zap,
} from 'lucide-react'

const getBlockIcon = (iconName: string) => {
  const icons: Record<string, React.ReactNode> = {
    zap: <Zap className="h-4 w-4" />,
    'file-text': <FileText className="h-4 w-4" />,
    'mouse-pointer': <MousePointer className="h-4 w-4" />,
  }
  return icons[iconName] || <Box className="h-4 w-4" />
}

const getPreview = (block: BlockProps): string => {
  switch (block.type) {
    case 'hero':
      return (block.props as HeroProps).title || '(sans titre)'
    case 'cta':
      return (block.props as CtaProps).text || '(sans texte)'
    case 'image':
      return (block.props as ImageProps).url ? '(image chargée)' : '(image non configurée)'
    case 'features':
      return `${(block.props as FeaturesProps).items?.length || 0} fonctionnalités`
    case 'section':
      return (block.props as SectionProps).title || '(sans titre)'
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

const SortableBlockInner: React.FC<SortableBlockProps> = ({
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const registryEntry = BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSelected) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      onDelete()
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      className={`p-2 cursor-pointer transition outline-none ${
        isSelected ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'
      } ${isDragging ? 'shadow-lg z-50' : ''}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0"
          title="Glisser pour réordonner"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </div>

        <span
          className="text-lg flex-shrink-0"
          title={registryEntry?.name || `Type inconnu: ${block.type}`}
        >
          {registryEntry ? getBlockIcon(registryEntry.iconName) : <Box className="h-4 w-4 text-muted-foreground" />}
        </span>

        <div className="flex gap-1 flex-shrink-0 ml-auto">
          {onMoveUp && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(event) => {
                event.stopPropagation()
                onMoveUp()
              }}
              title="Monter"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(event) => {
                event.stopPropagation()
                onMoveDown()
              }}
              title="Descendre"
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(event) => {
              event.stopPropagation()
              onDuplicate()
            }}
            title="Dupliquer"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-red-600"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            title="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{getPreview(block)}</p>
    </Card>
  )
}

export const SortableBlock = React.memo(SortableBlockInner, (prev, next) => {
  return (
    prev.block === next.block &&
    prev.isSelected === next.isSelected &&
    prev.onMoveUp === next.onMoveUp &&
    prev.onMoveDown === next.onMoveDown
  )
})
