'use client'

import { LineChart as RLineChart, Line, ResponsiveContainer } from 'recharts'
import type { z } from 'zod'
import type { sparklineSchema } from './schemas'

type Props = z.infer<typeof sparklineSchema>

/** Rendu recharts du bloc sparkline — chargé en dynamic (hors bundle public). */
export function SparklineView({ data, color = '#7C3AED' }: Props) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RLineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </RLineChart>
    </ResponsiveContainer>
  )
}
