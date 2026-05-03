'use client'

import React from 'react'
import { CtaProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EditableCtaBlockProps extends CtaProps {
  isSelected: boolean
  onEdit: (props: CtaProps) => void
}

export const EditableCtaBlock: React.FC<EditableCtaBlockProps> = ({
  text,
  link,
  variant,
  isSelected,
  onEdit,
}) => {
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEdit({ text: e.target.value, link, variant })
  }

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEdit({ text, link: e.target.value, variant })
  }

  const handleVariantChange = (value: string | null) => {
    if (value) {
      onEdit({ text, link, variant: (value as 'primary' | 'secondary') })
    }
  }

  const buttonClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'

  if (!isSelected) {
    // Display mode
    return (
      <div className="text-center py-8 cursor-pointer hover:bg-gray-50 transition-colors">
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${buttonClass}`}
          disabled
        >
          {text}
        </button>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="border-2 border-blue-400 rounded-lg p-4 bg-white space-y-3 shadow-md">
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Texte du bouton</label>
        <Input
          value={text}
          onChange={handleTextChange}
          placeholder="Texte du bouton"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Lien/URL</label>
        <Input
          value={link}
          onChange={handleLinkChange}
          placeholder="# ou https://..."
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600">Style</label>
        <Select value={variant} onValueChange={handleVariantChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Principal (bleu)</SelectItem>
            <SelectItem value="secondary">Secondaire (gris)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="p-2 bg-blue-100 border-t border-blue-300 text-xs text-blue-700">
        🔘 Mode édition - Modifiez directement ici
      </div>
    </div>
  )
}
