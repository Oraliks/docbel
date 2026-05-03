'use client'

import React from 'react'
import { HeroProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface HeroSettingsProps {
  value: HeroProps
  onChange: (props: HeroProps) => void
}

export const HeroSettings: React.FC<HeroSettingsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="hero-title" className="text-sm">
          Titre
        </Label>
        <Input
          id="hero-title"
          value={value.title || ''}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Titre du héros"
        />
      </div>
      <div>
        <Label htmlFor="hero-description" className="text-sm">
          Description
        </Label>
        <Textarea
          id="hero-description"
          value={value.description || ''}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Description"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="hero-color" className="text-sm">
          Couleur de fond
        </Label>
        <div className="flex gap-2">
          <Input
            id="hero-color"
            type="color"
            value={value.bgColor || '#000000'}
            onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
            className="h-10 w-20 cursor-pointer"
          />
          <Input
            type="text"
            value={value.bgColor || '#000000'}
            onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
            placeholder="#000000"
            className="flex-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="hero-image" className="text-sm">
          URL Image
        </Label>
        <Input
          id="hero-image"
          value={value.image || ''}
          onChange={(e) => onChange({ ...value, image: e.target.value })}
          placeholder="https://..."
        />
      </div>
    </div>
  )
}
