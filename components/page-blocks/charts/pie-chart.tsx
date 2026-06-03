'use client'

import dynamic from 'next/dynamic'
import { ChartBlockFallback } from '../_chart-fallback'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { ChartDataEditor } from './_chart-data-editor'
import { pieChartSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public. Le conteneur dimensionné
// reste rendu par le bloc (pas de CLS) ; seul le graphe recharts est différé.
const PieChartView = dynamic(
  () => import('./pie-chart-view').then((m) => ({ default: m.PieChartView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

export const pieChart = defineBlock({
  type: 'pieChart',
  schema,
  defaults: {
    title: '',
    data: [
      { label: 'Mobile', value: 45 },
      { label: 'Desktop', value: 35 },
      { label: 'Tablette', value: 20 },
    ],
    donut: false,
    height: 300,
  },
  meta: {
    name: 'Graphique camembert',
    description: 'Pie / Donut chart',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['pie', 'donut'],
  },
  Render: ({ props }) => {
    const { title, height = 300 } = props
    return (
      <div className="w-full my-2">
        {title && <h3 className="text-lg font-semibold mb-3 text-center">{title}</h3>}
        <div style={{ height }}>
          <PieChartView {...props} />
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
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
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Style donut (anneau)" className="flex-1">
            <span className="sr-only">donut</span>
          </Field>
          <Switch
            checked={props.donut ?? false}
            onCheckedChange={(v) => onChange({ donut: v })}
          />
        </div>
      </Group>
      <Group title={`Segments (${props.data.length})`} defaultOpen>
        <ChartDataEditor data={props.data} onChange={(data) => onChange({ data })} />
      </Group>
    </>
  ),
})
