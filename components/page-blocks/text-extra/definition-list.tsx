'use client'

import { Fragment } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Group } from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'

const itemSchema = z.object({
  term: z.string().max(200),
  definition: z.string().max(2000),
})

const schema = z.object({
  items: z.array(itemSchema).max(100),
})

type Item = z.infer<typeof itemSchema>

export const definitionList = defineBlock({
  type: 'definitionList',
  schema,
  defaults: {
    items: [
      { term: 'Terme 1', definition: 'Définition du premier terme.' },
      { term: 'Terme 2', definition: 'Définition du deuxième terme.' },
    ],
  },
  meta: {
    name: 'Liste de définitions',
    description: 'Termes et leurs définitions',
    category: 'text',
    icon: 'help-circle',
    shortcuts: ['dl', 'definitions'],
  },
  Render: ({ props }) => (
    <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 my-2">
      {props.items.map((item, i) => (
        <Fragment key={i}>
          <dt className="font-semibold md:col-span-1">{item.term}</dt>
          <dd className="text-sm text-muted-foreground md:col-span-2 leading-relaxed">
            {item.definition}
          </dd>
        </Fragment>
      ))}
    </dl>
  ),
  Fields: ({ props, onChange }) => (
    <Group title={`Définitions (${props.items.length})`} defaultOpen>
      <RepeaterList<Item>
        items={props.items}
        onChange={(items) => onChange({ items })}
        render={(item, set) => (
          <>
            <Input
              value={item.term}
              onChange={(e) => set({ term: e.target.value })}
              placeholder="Terme"
              className="h-8 text-xs"
            />
            <Textarea
              value={item.definition}
              onChange={(e) => set({ definition: e.target.value })}
              placeholder="Définition"
              rows={2}
              className="text-xs resize-y"
            />
          </>
        )}
        addItem={() => ({ term: 'Nouveau terme', definition: '' })}
      />
    </Group>
  ),
})
