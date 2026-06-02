'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { anchorMenuItemSchema, anchorMenuSchema as schema } from './schemas'

type Item = z.infer<typeof anchorMenuItemSchema>

export const anchorMenu = defineBlock({
  type: 'anchorMenu',
  schema,
  defaults: {
    items: [
      { label: 'Section 1', anchor: 'section-1' },
      { label: 'Section 2', anchor: 'section-2' },
    ],
    sticky: true,
  },
  meta: {
    name: 'Menu d\'ancres',
    description: 'Navigation par section',
    category: 'navigation',
    icon: 'arrow-right',
    shortcuts: ['anchor', 'menu'],
  },
  Render: ({ props }) => (
    <nav
      className={cn(
        'flex flex-wrap gap-2 rounded-2xl border bg-card/80 backdrop-blur p-2 my-2',
        props.sticky && 'sticky top-4 z-20'
      )}
    >
      {props.items.map((item, i) => (
        <a
          key={i}
          href={`#${item.anchor}`}
          className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
        >
          {item.label}
        </a>
      ))}
    </nav>
  ),
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Réglages" defaultOpen>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Sticky" className="flex-1">
            <span className="sr-only">sticky</span>
          </Field>
          <Switch
            checked={props.sticky ?? true}
            onCheckedChange={(v) => onChange({ sticky: v })}
          />
        </div>
      </Group>
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(it, set) => (
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                value={it.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
              <Input
                value={it.anchor}
                onChange={(e) => set({ anchor: e.target.value })}
                placeholder="ancre"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}
          addItem={() => ({ label: 'Nouvelle section', anchor: 'section' })}
        />
      </Group>
    </>
  ),
})
