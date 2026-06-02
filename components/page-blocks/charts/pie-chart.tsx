'use client'

import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
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

const COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

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
    const { title, data, donut, height = 300 } = props
    return (
      <div className="w-full my-2">
        {title && <h3 className="text-lg font-semibold mb-3 text-center">{title}</h3>}
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RPieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={Math.min(height / 3, 110)}
                innerRadius={donut ? Math.min(height / 5, 60) : 0}
                label
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RPieChart>
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
