import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FeaturesProps } from '@/lib/page-builder/types'
import { Plus, Trash2 } from 'lucide-react'

interface FeaturesSettingsProps {
  value: FeaturesProps
  onChange: (props: FeaturesProps) => void
}

export const FeaturesSettings: React.FC<FeaturesSettingsProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Titre (optionnel)</Label>
        <Input
          value={value.title || ''}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Nos fonctionnalités"
          className="mt-1"
        />
      </div>

      <div className="border-t pt-4">
        <Label className="text-sm font-medium block mb-3">Fonctionnalités</Label>
        <div className="space-y-3">
          {(value.items || []).map((item, idx) => (
            <div key={idx} className="p-3 bg-muted/50 rounded border space-y-2">
              <Input
                value={item.icon || ''}
                onChange={(e) => {
                  const newItems = [...value.items]
                  newItems[idx].icon = e.target.value
                  onChange({ ...value, items: newItems })
                }}
                placeholder="Emoji ou icône"
                className="text-sm"
              />
              <Input
                value={item.title || ''}
                onChange={(e) => {
                  const newItems = [...value.items]
                  newItems[idx].title = e.target.value
                  onChange({ ...value, items: newItems })
                }}
                placeholder="Titre"
                className="text-sm"
              />
              <textarea
                value={item.description || ''}
                onChange={(e) => {
                  const newItems = [...value.items]
                  newItems[idx].description = e.target.value
                  onChange({ ...value, items: newItems })
                }}
                placeholder="Description"
                className="text-sm w-full p-2 border rounded resize-none"
                rows={2}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newItems = value.items.filter((_, i) => i !== idx)
                  onChange({ ...value, items: newItems })
                }}
                className="text-red-600 hover:text-red-700 w-full"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Supprimer
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const newItems = [...(value.items || []), { title: '', description: '' }]
            onChange({ ...value, items: newItems })
          }}
          className="w-full mt-3"
        >
          <Plus className="h-4 w-4 mr-1" />
          Ajouter une fonctionnalité
        </Button>
      </div>
    </div>
  )
}
