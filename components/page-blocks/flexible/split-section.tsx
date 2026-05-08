'use client'

import { z } from 'zod'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  ratio: z.enum(['50-50', '60-40', '40-60', '70-30', '30-70']),
  reverseOnMobile: z.boolean().optional(),
})

type Props = z.infer<typeof schema>

const RATIO_CLASS: Record<Props['ratio'], string> = {
  '50-50': 'md:grid-cols-2',
  '60-40': 'md:grid-cols-[3fr_2fr]',
  '40-60': 'md:grid-cols-[2fr_3fr]',
  '70-30': 'md:grid-cols-[7fr_3fr]',
  '30-70': 'md:grid-cols-[3fr_7fr]',
}

export const splitSection = defineBlock({
  type: 'splitSection',
  schema,
  defaults: { ratio: '50-50', reverseOnMobile: false },
  meta: {
    name: 'Section split',
    description: 'Deux colonnes avec ratio configurable',
    category: 'layout',
    icon: 'columns-3',
    shortcuts: ['split'],
    canHaveChildren: true,
  },
  Render: ({ props, slot }) => {
    const { ratio, reverseOnMobile } = props
    return (
      <div
        className={cn(
          'grid gap-6 my-2',
          RATIO_CLASS[ratio],
          reverseOnMobile && 'flex flex-col-reverse md:grid'
        )}
      >
        {slot}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Disposition" defaultOpen>
      <Field label="Ratio">
        <Pills
          value={props.ratio}
          onChange={(v) => onChange({ ratio: v as Props['ratio'] })}
          options={[
            { value: '50-50', label: '50/50' },
            { value: '60-40', label: '60/40' },
            { value: '40-60', label: '40/60' },
            { value: '70-30', label: '70/30' },
            { value: '30-70', label: '30/70' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Inverser sur mobile" className="flex-1">
          <span className="sr-only">reverse</span>
        </Field>
        <Switch
          checked={props.reverseOnMobile ?? false}
          onCheckedChange={(v) => onChange({ reverseOnMobile: v })}
        />
      </div>
    </Group>
  ),
})
