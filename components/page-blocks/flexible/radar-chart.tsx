'use client'

import { z } from 'zod'
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Input } from '@/components/ui/input'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { radarChartSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const radarChart = defineBlock({
  type: 'radarChart',
  schema,
  defaults: {
    title: '',
    data: [
      { label: 'Performance', value: 80 },
      { label: 'Sécurité', value: 90 },
      { label: 'UX', value: 70 },
      { label: 'Vitesse', value: 85 },
      { label: 'Accessibilité', value: 75 },
    ],
    color: '#7C3AED',
    height: 300,
  },
  meta: {
    name: 'Radar chart',
    description: 'Graphique radar / spider',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['radar', 'spider'],
  },
  Render: ({ props }) => {
    const { title, data, color = '#7C3AED', height = 300 } = props
    const chartData = data.map((d) => ({ subject: d.label, value: d.value, max: d.max ?? 100 }))
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsRadarChart data={chartData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
              <PolarRadiusAxis stroke="var(--muted-foreground)" fontSize={10} />
              <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.3} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RechartsRadarChart>
          </ResponsiveContainer>
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
      <Field label="Hauteur">
        <SliderControl
          value={props.height ?? 300}
          onChange={(v) => onChange({ height: v })}
          min={150}
          max={600}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
