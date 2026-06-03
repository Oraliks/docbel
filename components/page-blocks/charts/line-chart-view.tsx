'use client'

import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import type { z } from 'zod'
import type { lineChartSchema } from './schemas'

type Props = z.infer<typeof lineChartSchema>

/** Rendu recharts du bloc lineChart — chargé en dynamic (hors bundle public). */
export function LineChartView({ data, color = '#7C3AED', smooth = true }: Props) {
  return (
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
  )
}
