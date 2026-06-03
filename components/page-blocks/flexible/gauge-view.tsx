'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts'
import type { z } from 'zod'
import type { gaugeSchema } from './schemas'

type Props = z.infer<typeof gaugeSchema>

/** Rendu recharts du bloc gauge — chargé en dynamic (hors bundle public). */
export function GaugeView({ value, color = '#7C3AED' }: Props) {
  const v = Math.max(0, Math.min(100, value))
  const data = [{ name: 'value', value: v, fill: color }]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        innerRadius="65%"
        outerRadius="100%"
        data={data}
        startAngle={180}
        endAngle={0}
        cx="50%"
        cy="100%"
      >
        <RadialBar
          dataKey="value"
          cornerRadius={10}
          fill={color}
          background={{ fill: 'var(--muted)' }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  )
}
