'use client'

import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { z } from 'zod'
import type { barChartSchema } from './schemas'

type Props = z.infer<typeof barChartSchema>

/** Rendu recharts du bloc barChart — chargé en dynamic (hors bundle public). */
export function BarChartView({ data, color = '#7C3AED', horizontal }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        {horizontal ? (
          <>
            <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis
              dataKey="label"
              type="category"
              stroke="var(--muted-foreground)"
              fontSize={12}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </RBarChart>
    </ResponsiveContainer>
  )
}
