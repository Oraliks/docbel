'use client'

import dynamic from 'next/dynamic'
import { ChartBlockFallback } from '../_chart-fallback'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { ChartDataEditor } from './_chart-data-editor'
import { lineChartSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public. Le conteneur dimensionné
// reste rendu par le bloc (pas de CLS) ; seul le graphe recharts est différé.
const LineChartView = dynamic(
  () => import('./line-chart-view').then((m) => ({ default: m.LineChartView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

export const lineChart = defineBlock({
  type: 'lineChart',
  schema,
  defaults: {
    title: '',
    data: [
      { label: 'Jan', value: 420 },
      { label: 'Fév', value: 580 },
      { label: 'Mar', value: 650 },
      { label: 'Avr', value: 720 },
      { label: 'Mai', value: 880 },
    ],
    color: '#7C3AED',
    smooth: true,
    height: 300,
  },
  meta: {
    name: 'Graphique en lignes',
    description: 'Line chart',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['line'],
  },
  Render: ({ props }) => {
    const { title, height = 300 } = props
    return (
      <div className="w-full my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <LineChartView {...props} />
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
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Courbe lissée" className="flex-1">
            <span className="sr-only">smooth</span>
          </Field>
          <Switch
            checked={props.smooth ?? true}
            onCheckedChange={(v) => onChange({ smooth: v })}
          />
        </div>
      </Group>
      <Group title={`Données (${props.data.length})`} defaultOpen>
        <ChartDataEditor data={props.data} onChange={(data) => onChange({ data })} />
      </Group>
    </>
  ),
})
