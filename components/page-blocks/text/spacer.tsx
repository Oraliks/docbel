'use client'

import { z } from 'zod'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  height: z.number().min(0).max(800).default(48),
})

export const spacer = defineBlock({
  type: 'spacer',
  schema,
  defaults: { height: 48 },
  meta: {
    name: 'Espace',
    description: 'Espace vertical',
    category: 'text',
    icon: 'arrow-up-down',
    shortcuts: ['spacer', 'espace'],
  },
  Render: ({ props }) => <div aria-hidden style={{ height: props.height }} />,
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Hauteur">
        <SliderControl
          value={props.height}
          onChange={(v) => onChange({ height: v })}
          min={0}
          max={400}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
