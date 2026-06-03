'use client'

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
import type { z } from 'zod'
import type { stackedBarSchema } from './schemas'

type Props = z.infer<typeof stackedBarSchema>

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

/** Rendu recharts du bloc stackedBar — chargé en dynamic (hors bundle public). */
export function StackedBarView({ data, series }: Props) {
  const chartData = data.map((d) => ({ label: d.label, ...d.values }))
  return (
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
  )
}
