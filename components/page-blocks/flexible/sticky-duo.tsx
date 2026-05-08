'use client'

import { Children } from 'react'
import { z } from 'zod'
import { Field, Group, Pills, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  stickySide: z.enum(['left', 'right']),
  topOffset: z.number().min(0).max(500).optional(),
})

type Props = z.infer<typeof schema>

export const stickyDuo = defineBlock({
  type: 'stickyDuo',
  schema,
  defaults: { stickySide: 'left', topOffset: 80 },
  meta: {
    name: 'Sticky duo',
    description: 'Une colonne fixe pendant le scroll',
    category: 'layout',
    icon: 'columns-3',
    shortcuts: ['sticky', 'duo'],
    canHaveChildren: true,
  },
  Render: ({ props, slot }) => {
    const { stickySide, topOffset = 80 } = props
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2 items-start">
        {Children.map(slot, (child, i) => (
          <div
            key={i}
            className={cn(
              (stickySide === 'left' && i === 0) || (stickySide === 'right' && i === 1)
                ? 'md:sticky'
                : ''
            )}
            style={{
              top:
                (stickySide === 'left' && i === 0) || (stickySide === 'right' && i === 1)
                  ? topOffset
                  : undefined,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Disposition" defaultOpen>
      <Field label="Colonne fixe">
        <Pills
          value={props.stickySide}
          onChange={(v) => onChange({ stickySide: v as Props['stickySide'] })}
          options={[
            { value: 'left', label: 'Gauche' },
            { value: 'right', label: 'Droite' },
          ]}
        />
      </Field>
      <Field label="Offset depuis le haut">
        <SliderControl
          value={props.topOffset ?? 80}
          onChange={(v) => onChange({ topOffset: v })}
          min={0}
          max={300}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
