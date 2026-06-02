'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { multiLineSchema as schema } from './schemas'

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

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
    const { title, data, series, height = 300 } = props
    const chartData = data.map((d) => ({ label: d.label, ...d.values }))
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {series.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
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
