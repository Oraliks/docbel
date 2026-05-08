'use client'

import { z } from 'zod'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  html: z.string().max(50000).default(''),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

type Props = z.infer<typeof schema>

const COLS: Record<Props['columns'], string> = {
  2: 'columns-2',
  3: 'md:columns-3',
  4: 'md:columns-4',
}
const GAP: Record<NonNullable<Props['gap']>, string> = {
  sm: 'gap-x-4',
  md: 'gap-x-8',
  lg: 'gap-x-12',
}

export const magazineColumns = defineBlock({
  type: 'magazineColumns',
  schema,
  defaults: {
    html: '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum euismod, sapien at malesuada egestas, justo ipsum vehicula nisi, in pharetra purus mi non massa.</p><p>Aenean fermentum, eros eu pellentesque eleifend, lectus mi euismod orci.</p>',
    columns: 2,
    gap: 'md',
  },
  meta: {
    name: 'Colonnes magazine',
    description: 'Texte sur plusieurs colonnes journal',
    category: 'layout',
    icon: 'columns-3',
    shortcuts: ['columns', 'magazine'],
  },
  Render: ({ props }) => {
    const { html, columns, gap = 'md' } = props
    return (
      <div
        className={cn(
          'text-base leading-relaxed my-2 [&_p]:mb-3 [&_p]:break-inside-avoid',
          COLS[columns],
          GAP[gap]
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Colonnes">
        <Pills
          value={props.columns}
          onChange={(v) => onChange({ columns: v as Props['columns'] })}
          options={[
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
          ]}
        />
      </Field>
      <Field label="Espacement">
        <Pills
          value={props.gap ?? 'md'}
          onChange={(v) => onChange({ gap: v as Props['gap'] })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
          ]}
        />
      </Field>
      <Field label="Texte (HTML)">
        <Textarea
          value={props.html}
          onChange={(e) => onChange({ html: e.target.value })}
          rows={6}
          className="text-xs resize-y"
        />
      </Field>
    </Group>
  ),
})
