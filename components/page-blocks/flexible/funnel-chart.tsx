'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import {
  ColorControl,
  Field,
  Group,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const stageSchema = z.object({
  label: z.string(),
  value: z.number(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  stages: z.array(stageSchema).max(20),
  color: z.string().optional(),
})

export const funnelChart = defineBlock({
  type: 'funnelChart',
  schema,
  defaults: {
    title: '',
    stages: [
      { label: 'Visiteurs', value: 10000 },
      { label: 'Inscrits', value: 3500 },
      { label: 'Actifs', value: 1200 },
      { label: 'Payants', value: 350 },
    ],
    color: '#7C3AED',
  },
  meta: {
    name: 'Funnel',
    description: 'Entonnoir de conversion',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['funnel', 'entonnoir'],
  },
  Render: ({ props }) => {
    const { title, stages, color = '#7C3AED' } = props
    const max = Math.max(...stages.map((s) => s.value), 1)
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div className="space-y-1.5 max-w-2xl mx-auto">
          {stages.map((s, i) => {
            const pct = (s.value / max) * 100
            const dropoff =
              i > 0 ? ((stages[i - 1].value - s.value) / stages[i - 1].value) * 100 : 0
            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="rounded-md py-3 text-center text-white font-medium text-sm transition-all"
                  style={{
                    width: `${pct}%`,
                    minWidth: 100,
                    backgroundColor: color,
                    opacity: 1 - i * 0.12,
                    marginLeft: `${(100 - pct) / 2}%`,
                    marginRight: `${(100 - pct) / 2}%`,
                    marginInline: 'auto',
                  }}
                >
                  {s.value.toLocaleString('fr-FR')}
                </div>
                <div className="text-xs w-32 shrink-0">
                  <div className="font-medium">{s.label}</div>
                  {i > 0 && (
                    <div className="text-muted-foreground">-{dropoff.toFixed(0)}%</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Apparence" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
    </Group>
  ),
})
