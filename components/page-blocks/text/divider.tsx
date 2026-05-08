'use client'

import { z } from 'zod'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  variant: z.enum(['solid', 'dashed', 'dotted', 'gradient']).optional(),
  thickness: z.number().min(1).max(20).optional(),
})

export const divider = defineBlock({
  type: 'divider',
  schema,
  defaults: { variant: 'solid', thickness: 1 },
  meta: {
    name: 'Séparateur',
    description: 'Ligne horizontale',
    category: 'text',
    icon: 'minus',
    shortcuts: ['hr', 'divider', 'separateur', 'ligne'],
  },
  Render: ({ props }) => {
    const { variant = 'solid', thickness = 1 } = props
    if (variant === 'gradient') {
      return (
        <hr
          className="border-0 my-2 bg-gradient-to-r from-transparent via-border to-transparent"
          style={{ height: thickness }}
        />
      )
    }
    return (
      <hr
        className="my-2"
        style={{
          borderTopStyle: variant,
          borderTopWidth: thickness,
          borderColor: 'var(--border)',
        }}
      />
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Épaisseur">
        <SliderControl
          value={props.thickness ?? 1}
          onChange={(v) => onChange({ thickness: v })}
          min={1}
          max={10}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
