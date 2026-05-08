'use client'

import { Fragment } from 'react'
import { z } from 'zod'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  count: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

type Props = z.infer<typeof schema>

const COLUMN_GAP: Record<NonNullable<Props['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-6',
  lg: 'gap-10',
}

const COLUMN_GRID: Record<Props['count'], string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

export const columns = defineBlock({
  type: 'columns',
  schema,
  defaults: { count: 2, gap: 'md' },
  meta: {
    name: 'Colonnes',
    description: 'Grille à 2/3/4 colonnes',
    category: 'layout',
    icon: 'columns-3',
    shortcuts: ['columns', 'colonnes', 'grid'],
    canHaveChildren: true,
  },
  Render: ({ props, slotByIndex }) => (
    <div className={cn('grid w-full', COLUMN_GRID[props.count], COLUMN_GAP[props.gap ?? 'md'])}>
      {Array.from({ length: props.count }).map((_, i) => (
        <Fragment key={i}>{slotByIndex?.(i)}</Fragment>
      ))}
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nombre de colonnes">
        <Pills
          value={props.count}
          onChange={(v) => onChange({ count: v as Props['count'] })}
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
    </Group>
  ),
})
