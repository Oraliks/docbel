'use client'

import React from 'react'
import { HeroProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'

interface EditableHeroBlockProps extends HeroProps {
  isSelected: boolean
  onEdit: (props: HeroProps) => void
}

export const EditableHeroBlock: React.FC<EditableHeroBlockProps> = ({
  title,
  description,
  bgColor,
  image,
  isSelected,
  onEdit,
}) => {
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEdit({ title: e.target.value, description, bgColor, image })
  }

  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEdit({ title, description: e.target.value, bgColor, image })
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEdit({ title, description, bgColor: e.target.value, image })
  }

  if (!isSelected) {
    // Display mode
    return (
      <div
        style={{ backgroundColor: bgColor || '#000' }}
        className="rounded-lg p-16 text-white text-center cursor-pointer hover:opacity-90 transition-opacity"
      >
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-xl">{description}</p>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="border-2 border-blue-400 rounded-lg p-4 bg-white space-y-3 shadow-md">
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Titre</label>
        <Input
          value={title}
          onChange={handleTitleChange}
          className="text-lg font-bold"
          placeholder="Titre du héros"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Description</label>
        <Input
          value={description}
          onChange={handleDescChange}
          placeholder="Description courte"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Couleur de fond</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={bgColor || '#000000'}
            onChange={handleColorChange}
            className="w-12 h-10 rounded cursor-pointer"
          />
          <Input
            value={bgColor || ''}
            onChange={handleColorChange}
            className="text-sm font-mono"
            placeholder="#000000"
          />
        </div>
      </div>
      <div className="p-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
        📝 Mode édition - Modifiez directement ici
      </div>
    </div>
  )
}
