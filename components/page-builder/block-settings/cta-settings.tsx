'use client'

import React from 'react'
import { CtaProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CtaSettingsProps {
  value: CtaProps
  onChange: (props: CtaProps) => void
}

export const CtaSettings: React.FC<CtaSettingsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cta-text" className="text-sm">
          Texte du bouton
        </Label>
        <Input
          id="cta-text"
          value={value.text || ''}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="Cliquer ici"
        />
      </div>
      <div>
        <Label htmlFor="cta-link" className="text-sm">
          Lien
        </Label>
        <Input
          id="cta-link"
          value={value.link || ''}
          onChange={(e) => onChange({ ...value, link: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div>
        <Label htmlFor="cta-variant" className="text-sm">
          Style
        </Label>
        <Select
          value={value.variant || 'primary'}
          onValueChange={(v) =>
            onChange({
              ...value,
              variant: v as 'primary' | 'secondary',
            })
          }
        >
          <SelectTrigger id="cta-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Principal</SelectItem>
            <SelectItem value="secondary">Secondaire</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
