'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { highlightSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const COLORS: Record<NonNullable<Props['color']>, string> = {
  yellow: 'bg-yellow-200 dark:bg-yellow-500/30',
  green: 'bg-emerald-200 dark:bg-emerald-500/30',
  pink: 'bg-pink-200 dark:bg-pink-500/30',
  blue: 'bg-blue-200 dark:bg-blue-500/30',
  orange: 'bg-orange-200 dark:bg-orange-500/30',
}

export const highlight = defineBlock({
  type: 'highlight',
  schema,
  defaults: { text: 'Texte important', color: 'yellow' },
  meta: {
    name: 'Surligné',
    description: 'Texte surligné couleur',
    category: 'text',
    icon: 'type',
    shortcuts: ['highlight', 'surligne'],
  },
  Render: ({ props }) => (
    <p className="my-2">
      <mark className={cn('px-1.5 py-0.5 rounded', COLORS[props.color ?? 'yellow'])}>
        {props.text}
      </mark>
    </p>
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Couleur">
        <Pills
          value={props.color ?? 'yellow'}
          onChange={(v) => onChange({ color: v as Props['color'] })}
          options={[
            { value: 'yellow', label: 'Jaune' },
            { value: 'green', label: 'Vert' },
            { value: 'pink', label: 'Rose' },
            { value: 'blue', label: 'Bleu' },
            { value: 'orange', label: 'Orange' },
          ]}
        />
      </Field>
    </Group>
  ),
})
