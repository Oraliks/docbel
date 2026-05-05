'use client'

import React, { useState } from 'react'
import { BlockProps } from '@/lib/page-builder/types'
import { Copy, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react'

interface EditablePreviewBlockProps {
  block: BlockProps
  isSelected: boolean
  onSelect: () => void
  onEdit: (props: Record<string, unknown>) => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onAddBlockAfter?: () => void
  children: React.ReactNode
}

export const EditablePreviewBlock: React.FC<EditablePreviewBlockProps> = ({
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddBlockAfter,
  children,
}) => {
  const [showControls, setShowControls] = useState(false)

  return (
    <div
      className={`relative group transition-all ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''
      }`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={onSelect}
    >
      {/* Block content */}
      <div className={isSelected ? 'pointer-events-auto' : 'pointer-events-none'}>
        {children}
      </div>

      {/* Hover Controls */}
      {showControls && (
        <div className="absolute top-0 right-0 p-2 bg-white/95 backdrop-blur rounded-lg shadow-lg flex gap-1 z-10">
          {/* Move Up */}
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUp()
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors group/btn relative"
              title="Déplacer vers le haut"
            >
              <ChevronUp className="h-4 w-4 text-gray-600" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover/btn:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                Déplacer vers le haut
              </div>
            </button>
          )}

          {/* Move Down */}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors group/btn relative"
              title="Déplacer vers le bas"
            >
              <ChevronDown className="h-4 w-4 text-gray-600" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover/btn:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                Déplacer vers le bas
              </div>
            </button>
          )}

          {/* Add Block After */}
          {onAddBlockAfter && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddBlockAfter()
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors group/btn relative"
              title="Ajouter un bloc après"
            >
              <Plus className="h-4 w-4 text-gray-600" />
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover/btn:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                Ajouter un bloc après
              </div>
            </button>
          )}

          {/* Duplicate */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate()
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors group/btn relative"
            title="Dupliquer"
          >
            <Copy className="h-4 w-4 text-gray-600" />
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover/btn:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
              Dupliquer
            </div>
          </button>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 hover:bg-red-100 rounded transition-colors group/btn relative"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 hidden group-hover/btn:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
              Supprimer
            </div>
          </button>
        </div>
      )}

      {/* Selection border for unselected blocks on hover */}
      {showControls && !isSelected && (
        <div className="absolute inset-0 border-2 border-blue-300 pointer-events-none rounded" />
      )}
    </div>
  )
}
