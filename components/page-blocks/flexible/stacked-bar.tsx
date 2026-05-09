'use client'

import { z } from 'zod'
import {
  BarChart,
  Bar,
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

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

const dataSchema = z.object({
  label: z.string(),
  values: z.record(z.string(), z.number()),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(dataSchema).max(50),
  series: z.array(z.string()).max(20),
  height: z.number().min(50).max(2000).optional(),
})

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
    const { title, data, series, height = 300 } = props
    const chartData = data.map((d) => ({ label: d.label, ...d.values }))
    return (
      <div className="my-2">
        {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </BarChart>
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
