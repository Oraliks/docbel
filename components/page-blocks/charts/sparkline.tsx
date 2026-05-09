'use client'

import { z } from 'zod'
import { LineChart as RLineChart, Line, ResponsiveContainer } from 'recharts'
import { Input } from '@/components/ui/input'
import { ColorControl, Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  data: z.array(z.number()).max(500),
  color: z.string().optional(),
  label: z.string().max(200).optional(),
  value: z.string().max(120).optional(),
})

export const sparkline = defineBlock({
  type: 'sparkline',
  schema,
  defaults: {
    data: [10, 14, 12, 18, 22, 28, 35, 32, 40, 45, 50, 58],
    color: '#7C3AED',
    label: 'Croissance',
    value: '+23%',
  },
  meta: {
    name: 'Sparkline',
    description: 'Mini-graphique inline',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['sparkline'],
  },
  Render: ({ props }) => {
    const { data, color = '#7C3AED', label, value } = props
    const chartData = data.map((v, i) => ({ i, v }))
    return (
      <div className="rounded-2xl border bg-card p-4 my-2">
        <div className="flex items-end justify-between">
          <div>
            {label && <div className="text-xs text-muted-foreground">{label}</div>}
            {value && <div className="text-2xl font-bold">{value}</div>}
          </div>
          <div style={{ width: 120, height: 40 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={chartData}>
                <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
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
      <Field label="Valeur affichée">
        <Input
          value={props.value ?? ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="+23%"
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <Field label="Données (chiffres séparés par des virgules)">
        <Input
          value={props.data.join(', ')}
          onChange={(e) =>
            onChange({
              data: e.target.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n)),
            })
          }
          placeholder="10, 14, 12, 18"
          className="font-mono text-xs"
        />
      </Field>
    </Group>
  ),
})
