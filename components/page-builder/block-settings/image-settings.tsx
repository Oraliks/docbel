import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageProps } from '@/lib/page-builder/types'

interface ImageSettingsProps {
  value: ImageProps
  onChange: (props: ImageProps) => void
}

export const ImageSettings: React.FC<ImageSettingsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">URL de l'image</Label>
        <Input
          value={value.url || ''}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          placeholder="https://..."
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Texte alternatif</Label>
        <Input
          value={value.alt || ''}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          placeholder="Description de l'image"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Légende (optionnel)</Label>
        <Input
          value={value.caption || ''}
          onChange={(e) => onChange({ ...value, caption: e.target.value })}
          placeholder="Légende"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Largeur</Label>
        <Input
          value={value.width || '100%'}
          onChange={(e) => onChange({ ...value, width: e.target.value })}
          placeholder="100% ou 500px"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Hauteur</Label>
        <Input
          value={value.height || 'auto'}
          onChange={(e) => onChange({ ...value, height: e.target.value })}
          placeholder="auto ou 300px"
          className="mt-1"
        />
      </div>
    </div>
  )
}
