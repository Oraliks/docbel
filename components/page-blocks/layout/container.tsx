'use client'

import { z } from 'zod'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  width: z.enum(['sm', 'md', 'lg', 'xl', 'full']).optional(),
})

type Props = z.infer<typeof schema>

const WIDTH_CLASS: Record<NonNullable<Props['width']>, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-none',
}

export const container = defineBlock({
  type: 'container',
  schema,
  defaults: { width: 'lg' },
  meta: {
    name: 'Conteneur',
    description: 'Conteneur centré (max-width)',
    category: 'layout',
    icon: 'box',
    shortcuts: ['container', 'conteneur'],
    canHaveChildren: true,
  },
  Render: ({ props, slot }) => (
    <div className={cn('mx-auto px-4 md:px-6 w-full', WIDTH_CLASS[props.width ?? 'lg'])}>
      {slot}
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Largeur max">
        <Pills
          value={props.width ?? 'lg'}
          onChange={(v) => onChange({ width: v as Props['width'] })}
          options={[
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
            { value: 'xl', label: 'XL' },
            { value: 'full', label: '100%' },
          ]}
        />
      </Field>
    </Group>
  ),
})
