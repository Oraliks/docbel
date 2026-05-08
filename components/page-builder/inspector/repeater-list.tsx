'use client'

import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RepeaterListProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  render: (item: T, setItem: (patch: Partial<T>) => void) => ReactNode
  addItem: () => T
  addLabel?: string
}

export function RepeaterList<T>({
  items,
  onChange,
  render,
  addItem,
  addLabel = 'Ajouter',
}: RepeaterListProps<T>) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>#{idx + 1}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 text-destructive"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          {render(item, (patch) =>
            onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
          )}
        </div>
      ))}
      <Button variant="outline" className="w-full h-8" onClick={() => onChange([...items, addItem()])}>
        <Plus className="mr-1.5 size-3.5" />
        {addLabel}
      </Button>
    </div>
  )
}
