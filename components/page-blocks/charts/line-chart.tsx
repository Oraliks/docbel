'use client'

import { z } from 'zod'
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
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

const dataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(dataPointSchema).max(100),
  color: z.string().optional(),
  smooth: z.boolean().optional(),
  height: z.number().min(50).max(2000).optional(),
})

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
    color: '#C8102E',
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
    const { title, data, color = '#C8102E', smooth = true, height = 300 } = props
    return (
      <div className="w-full my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RLineChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type={smooth ? 'monotone' : 'linear'}
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </RLineChart>
          </ResponsiveContainer>
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
