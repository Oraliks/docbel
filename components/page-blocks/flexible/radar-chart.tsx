'use client'

import dynamic from 'next/dynamic'
import { ChartBlockFallback } from '../_chart-fallback'
import { Input } from '@/components/ui/input'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { radarChartSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public.
const RadarChartView = dynamic(
  () => import('./radar-chart-view').then((m) => ({ default: m.RadarChartView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

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
    const { title, height = 300 } = props
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <RadarChartView {...props} />
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
