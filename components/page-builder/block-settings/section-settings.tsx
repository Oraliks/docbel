import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionProps } from '@/lib/page-builder/types'

interface SectionSettingsProps {
  value: SectionProps
  onChange: (props: SectionProps) => void
}

export const SectionSettings: React.FC<SectionSettingsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Titre (optionnel)</Label>
        <Input
          value={value.title || ''}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Titre de la section"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Description (optionnel)</Label>
        <textarea
          value={value.description || ''}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Description"
          className="w-full p-2 border rounded text-sm resize-none mt-1"
          rows={3}
        />
      </div>

      <div>
        <Label className="text-sm font-medium">Couleur de fond</Label>
        <div className="flex gap-2 mt-1">
          <Input
            type="color"
            value={value.bgColor || '#f5f5f5'}
            onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
            className="h-10 w-20"
          />
          <Input
            value={value.bgColor || '#f5f5f5'}
            onChange={(e) => onChange({ ...value, bgColor: e.target.value })}
            placeholder="#f5f5f5"
            className="flex-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Espacement</Label>
        <Select value={value.padding || 'large'} onValueChange={(p) => onChange({ ...value, padding: p as 'small' | 'medium' | 'large' })}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Petit (16px)</SelectItem>
            <SelectItem value="medium">Moyen (32px)</SelectItem>
            <SelectItem value="large">Grand (48px)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
