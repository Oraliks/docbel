'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { checklistItemSchema as itemSchema, checklistSchema as schema } from './schemas'

type Item = z.infer<typeof itemSchema>

export const checklist = defineBlock({
  type: 'checklist',
  schema,
  defaults: {
    title: 'À vérifier',
    items: [
      { text: 'Premier élément', checked: false },
      { text: 'Deuxième élément', checked: false },
      { text: 'Troisième élément', checked: false },
    ],
    interactive: true,
  },
  meta: {
    name: 'Checklist',
    description: 'Liste avec cases à cocher',
    category: 'text',
    icon: 'check',
    shortcuts: ['checklist', 'todo'],
  },
  Render: ({ props }) => {
    const { title, items, interactive = true } = props
    const [checked, setChecked] = useState<boolean[]>(() => items.map((it) => !!it.checked))
    const toggle = (i: number) =>
      setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))

    useEffect(() => {
      setChecked(items.map((it) => !!it.checked))
    }, [items])

    const completed = checked.filter(Boolean).length

    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <span className="text-xs text-muted-foreground">
              {completed} / {items.length}
            </span>
          </div>
        )}
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => interactive && toggle(i)}
                disabled={!interactive}
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2 transition',
                  checked[i]
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input hover:border-muted-foreground',
                  !interactive && 'cursor-default'
                )}
              >
                {checked[i] && <Check className="size-3" />}
              </button>
              <span
                className={cn(
                  'text-sm leading-snug',
                  checked[i] && 'line-through text-muted-foreground'
                )}
              >
                {it.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Interactif (cocher en lecture)" className="flex-1">
            <span className="sr-only">interactive</span>
          </Field>
          <Switch
            checked={props.interactive ?? true}
            onCheckedChange={(v) => onChange({ interactive: v })}
          />
        </div>
      </Group>
      <Group title={`Items (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Input
                value={item.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder="Élément"
                className="h-8 text-xs"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Coché par défaut</span>
                <Switch
                  checked={item.checked ?? false}
                  onCheckedChange={(v) => set({ checked: v })}
                />
              </div>
            </>
          )}
          addItem={() => ({ text: 'Nouvel élément', checked: false })}
        />
      </Group>
    </>
  ),
})
