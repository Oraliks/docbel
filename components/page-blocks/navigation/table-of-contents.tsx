'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { tableOfContentsSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

interface TocItem {
  level: number
  text: string
  id: string
}

export const tableOfContents = defineBlock({
  type: 'tableOfContents',
  schema,
  defaults: { title: 'Sommaire', sticky: false, maxLevel: 3 },
  meta: {
    name: 'Sommaire',
    description: 'Table des matières auto',
    category: 'navigation',
    icon: 'help-circle',
    shortcuts: ['toc', 'sommaire'],
  },
  Render: ({ props }) => {
    const { title = 'Sommaire', sticky, maxLevel = 3 } = props
    const [items, setItems] = useState<TocItem[]>([])
    useEffect(() => {
      const scope = document.querySelector('.page-content') ?? document.body
      const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(',')
      const list: TocItem[] = []
      scope.querySelectorAll(selector).forEach((el, idx) => {
        const tag = el.tagName.toLowerCase()
        const level = Number(tag.replace('h', ''))
        const text = el.textContent ?? ''
        if (!text.trim()) return
        let id = el.id
        if (!id) {
          id =
            text
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 60) +
            '-' +
            idx
          el.id = id
        }
        list.push({ level, text, id })
      })
      setItems(list)
    }, [maxLevel])

    return (
      <nav className={cn('rounded-2xl border bg-card p-4 my-2', sticky && 'sticky top-4')}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {title}
        </p>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">(Aucun titre détecté)</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {items.map((item, i) => (
              <li key={i}>
                <a
                  href={`#${item.id}`}
                  className="block hover:text-primary transition"
                  style={{ paddingLeft: (item.level - 1) * 12 }}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Réglages" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Profondeur max">
        <Pills
          value={props.maxLevel ?? 3}
          onChange={(v) => onChange({ maxLevel: v as Props['maxLevel'] })}
          options={[
            { value: 2, label: 'H2' },
            { value: 3, label: 'H3' },
            { value: 4, label: 'H4' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Sticky" className="flex-1">
          <span className="sr-only">sticky</span>
        </Field>
        <Switch
          checked={props.sticky ?? false}
          onCheckedChange={(v) => onChange({ sticky: v })}
        />
      </div>
    </Group>
  ),
})
