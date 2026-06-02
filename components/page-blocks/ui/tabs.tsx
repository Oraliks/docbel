'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { tabsSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const tabs = defineBlock({
  type: 'tabs',
  schema,
  defaults: {
    items: [
      { label: 'Onglet 1', content: 'Contenu de l’onglet 1.' },
      { label: 'Onglet 2', content: 'Contenu de l’onglet 2.' },
      { label: 'Onglet 3', content: 'Contenu de l’onglet 3.' },
    ],
    variant: 'default',
  },
  meta: {
    name: 'Onglets',
    description: 'Contenu organisé en onglets',
    category: 'ui',
    icon: 'columns-3',
    shortcuts: ['tabs', 'onglets'],
    variants: [
      { id: 'default', name: 'Standard' },
      { id: 'pills', name: 'Pilules' },
      { id: 'underline', name: 'Souligné' },
    ],
  },
  Render: ({ props }) => {
    const { items, variant = 'default' } = props
    const [active, setActive] = useState('0')

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Aucun onglet
        </div>
      )
    }

    if (variant === 'pills') {
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(String(i))}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  active === String(i)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {it.label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
        </div>
      )
    }

    if (variant === 'underline') {
      return (
        <div>
          <div className="flex border-b">
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(String(i))}
                className={cn(
                  'border-b-2 px-4 py-2 -mb-px text-sm font-medium transition',
                  active === String(i)
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {it.label}
              </button>
            ))}
          </div>
          <div className="pt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
        </div>
      )
    }

    return (
      <div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(String(i))}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-all',
                active === String(i)
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="pt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title={`Onglets (${props.items.length})`} defaultOpen>
      <RepeaterList<Props['items'][number]>
        items={props.items}
        onChange={(items) => onChange({ items })}
        render={(item, set) => (
          <>
            <Input
              value={item.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Libellé de l’onglet"
              className="h-8 text-xs"
            />
            <Textarea
              value={item.content}
              onChange={(e) => set({ content: e.target.value })}
              placeholder="Contenu (HTML autorisé)"
              rows={3}
              className="resize-y text-xs"
            />
          </>
        )}
        addItem={() => ({ label: 'Nouvel onglet', content: '' })}
      />
    </Group>
  ),
})
