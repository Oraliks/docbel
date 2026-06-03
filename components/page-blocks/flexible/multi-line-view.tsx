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
import type { z } from 'zod'
import type { multiLineSchema } from './schemas'

type Props = z.infer<typeof multiLineSchema>

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

/** Rendu recharts du bloc multiLine — chargé en dynamic (hors bundle public). */
export function MultiLineView({ data, series }: Props) {
  const chartData = data.map((d) => ({ label: d.label, ...d.values }))
  return (
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
  )
}
