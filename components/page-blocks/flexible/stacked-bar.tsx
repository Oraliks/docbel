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
import { stackedBarSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public.
const StackedBarView = dynamic(
  () => import('./stacked-bar-view').then((m) => ({ default: m.StackedBarView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

export const stackedBar = defineBlock({
  type: 'stackedBar',
  schema,
  defaults: {
    title: '',
    series: ['Q1', 'Q2', 'Q3', 'Q4'],
    data: [
      { label: 'Produit A', values: { Q1: 120, Q2: 180, Q3: 220, Q4: 280 } },
      { label: 'Produit B', values: { Q1: 80, Q2: 120, Q3: 160, Q4: 200 } },
      { label: 'Produit C', values: { Q1: 40, Q2: 60, Q3: 90, Q4: 120 } },
    ],
    height: 300,
  },
  meta: {
    name: 'Barres empilées',
    description: 'Stacked bar chart',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['stacked'],
  },
  Render: ({ props }) => {
    const { title, height = 300 } = props
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <StackedBarView {...props} />
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
