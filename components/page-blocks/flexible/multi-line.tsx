'use client'

import dynamic from 'next/dynamic'
import { ChartBlockFallback } from '../_chart-fallback'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { multiLineSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public.
const MultiLineView = dynamic(
  () => import('./multi-line-view').then((m) => ({ default: m.MultiLineView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

export const multiLine = defineBlock({
  type: 'multiLine',
  schema,
  defaults: {
    title: '',
    series: ['2023', '2024'],
    data: [
      { label: 'Jan', values: { '2023': 120, '2024': 180 } },
      { label: 'Fév', values: { '2023': 180, '2024': 240 } },
      { label: 'Mar', values: { '2023': 240, '2024': 320 } },
      { label: 'Avr', values: { '2023': 280, '2024': 380 } },
    ],
    height: 300,
  },
  meta: {
    name: 'Multi-line',
    description: 'Plusieurs courbes',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['multiline'],
  },
  Render: ({ props }) => {
    const { title, height = 300 } = props
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <MultiLineView {...props} />
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
