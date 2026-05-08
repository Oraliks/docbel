'use client'

import { z } from 'zod'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  colors: z.array(z.string()).default([]),
  height: z.number().min(50).max(2000).optional(),
  animated: z.boolean().optional(),
})

export const gradientMesh = defineBlock({
  type: 'gradientMesh',
  schema,
  defaults: {
    colors: ['#C8102E', '#3B82F6', '#10B981', '#F59E0B'],
    height: 300,
    animated: true,
  },
  meta: {
    name: 'Gradient mesh',
    description: 'Fond dégradé multi-couleurs',
    category: 'decorative',
    icon: 'sparkles',
    shortcuts: ['gradient', 'mesh'],
  },
  Render: ({ props }) => {
    const { colors, height = 300, animated } = props
    const bg = colors
      .map((c, i) => {
        const positions = ['10% 10%', '90% 20%', '20% 80%', '85% 85%', '50% 50%']
        const pos = positions[i % positions.length]
        return `radial-gradient(circle at ${pos}, ${c}aa, transparent 50%)`
      })
      .join(', ')
    return (
      <div
        className={cn('rounded-2xl my-2 overflow-hidden', animated && 'animate-pulse')}
        style={{ backgroundImage: bg, height, backgroundColor: colors[0] }}
      />
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Couleurs (HEX, séparées par virgules)">
        <Input
          value={props.colors.join(', ')}
          onChange={(e) =>
            onChange({
              colors: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          className="font-mono text-xs"
        />
      </Field>
      <Field label="Hauteur">
        <SliderControl
          value={props.height ?? 300}
          onChange={(v) => onChange({ height: v })}
          min={100}
          max={800}
          suffix="px"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Animé" className="flex-1">
          <span className="sr-only">animated</span>
        </Field>
        <Switch
          checked={props.animated ?? false}
          onCheckedChange={(v) => onChange({ animated: v })}
        />
      </div>
    </Group>
  ),
})
