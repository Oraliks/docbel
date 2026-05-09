'use client'

import { z } from 'zod'
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  label: z.string().max(200).optional(),
  value: z.number().min(0).max(100).default(0),
  color: z.string().optional(),
  showValue: z.boolean().optional(),
})

export const gauge = defineBlock({
  type: 'gauge',
  schema,
  defaults: { label: 'Score', value: 75, color: '#7C3AED', showValue: true },
  meta: {
    name: 'Jauge',
    description: 'Indicateur en arc de cercle',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['gauge', 'jauge'],
  },
  Render: ({ props }) => {
    const { label, value, color = '#7C3AED', showValue = true } = props
    const v = Math.max(0, Math.min(100, value))
    const data = [{ name: 'value', value: v, fill: color }]
    return (
      <div className="my-2 inline-block w-48">
        {label && (
          <div className="text-center text-xs font-medium text-muted-foreground mb-1">
            {label}
          </div>
        )}
        <div className="relative" style={{ height: 130 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="65%"
              outerRadius="100%"
              data={data}
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="100%"
            >
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                fill={color}
                background={{ fill: 'var(--muted)' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          {showValue && (
            <div className="absolute inset-x-0 bottom-2 text-center text-2xl font-bold">
              {v}%
            </div>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé">
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Valeur">
        <SliderControl
          value={props.value}
          onChange={(v) => onChange({ value: v })}
          min={0}
          max={100}
          suffix="%"
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Afficher la valeur" className="flex-1">
          <span className="sr-only">Show value</span>
        </Field>
        <Switch
          checked={props.showValue ?? true}
          onCheckedChange={(v) => onChange({ showValue: v })}
        />
      </div>
    </Group>
  ),
})
