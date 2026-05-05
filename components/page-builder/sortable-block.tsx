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
      return (block.props as unknown as HeroProps).title || '(sans titre)'
    case 'cta':
      return (block.props as unknown as CtaProps).text || '(sans texte)'
    case 'image':
      return (block.props as unknown as ImageProps).url ? '(image chargee)' : '(image non configuree)'
    case 'features':
      return `${(block.props as unknown as FeaturesProps).items?.length || 0} fonctionnalites`
    case 'section':
      return (block.props as unknown as SectionProps).title || '(sans titre)'
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

  const registryEntry = BLOCK_REGISTRY[block.type as keyof typeof BLOCK_REGISTRY]

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
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing flex-shrink-0 group/drag relative"
          title="Glissez pour reordonner"
        >
          <GripVertical className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/drag:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
            Glissez pour reordonner
          </div>
        </div>

        {registryEntry ? (
          <span
            className="text-lg flex-shrink-0 cursor-help group/icon relative"
            title={registryEntry.name}
          >
            {getBlockIcon(registryEntry.iconName)}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/icon:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              {registryEntry.name}
            </div>
          </span>
        ) : (
          <span
            className="text-lg flex-shrink-0 cursor-help group/icon relative text-gray-400"
            title="Type de bloc inconnu"
          >
            <Box className="h-4 w-4" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/icon:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
              Type inconnu: {block.type}
            </div>
          </span>
        )}

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
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{getPreview(block)}</p>
    </Card>
  )
}
