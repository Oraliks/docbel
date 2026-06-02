'use client'

import { z } from 'zod'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { flexContainerSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const GAP_CLASS: Record<NonNullable<Props['gap']>, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-10',
}

export const flexContainer = defineBlock({
  type: 'flexContainer',
  schema,
  defaults: {
    direction: 'row',
    gap: 'md',
    wrap: true,
    justify: 'start',
    align: 'start',
  },
  meta: {
    name: 'Conteneur flex',
    description: 'Container flexbox configurable',
    category: 'layout',
    icon: 'box',
    shortcuts: ['flex'],
    canHaveChildren: true,
  },
  Render: ({ props, slot }) => {
    const { direction, gap = 'md', align = 'start', justify = 'start', wrap = true } = props
    const flexDir = `flex-${direction}`
    const alignClass = `items-${align}`
    const justifyClass =
      justify === 'space-between'
        ? 'justify-between'
        : justify === 'space-around'
          ? 'justify-around'
          : `justify-${justify}`
    return (
      <div
        className={cn(
          'flex',
          flexDir,
          GAP_CLASS[gap],
          alignClass,
          justifyClass,
          wrap && 'flex-wrap',
          'my-2'
        )}
      >
        {slot}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Disposition" defaultOpen>
      <Field label="Direction">
        <Pills
          value={props.direction}
          onChange={(v) => onChange({ direction: v as Props['direction'] })}
          options={[
            { value: 'row', label: 'Horizontal' },
            { value: 'col', label: 'Vertical' },
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
            { value: 'xl', label: 'XL' },
          ]}
        />
      </Field>
      <Field label="Alignement">
        <Pills
          value={props.align ?? 'start'}
          onChange={(v) => onChange({ align: v as Props['align'] })}
          options={[
            { value: 'start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'end', label: 'End' },
            { value: 'stretch', label: 'Stretch' },
          ]}
        />
      </Field>
      <Field label="Justification">
        <Pills
          value={props.justify ?? 'start'}
          onChange={(v) => onChange({ justify: v as Props['justify'] })}
          options={[
            { value: 'start', label: 'Start' },
            { value: 'center', label: 'Center' },
            { value: 'end', label: 'End' },
            { value: 'space-between', label: 'Between' },
            { value: 'space-around', label: 'Around' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Wrap" className="flex-1">
          <span className="sr-only">wrap</span>
        </Field>
        <Switch
          checked={props.wrap ?? true}
          onCheckedChange={(v) => onChange({ wrap: v })}
        />
      </div>
    </Group>
  ),
})
