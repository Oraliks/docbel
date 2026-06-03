'use client'

import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { z } from 'zod'
import type { radarChartSchema } from './schemas'

type Props = z.infer<typeof radarChartSchema>

/** Rendu recharts du bloc radarChart — chargé en dynamic (hors bundle public). */
export function RadarChartView({ data, color = '#7C3AED' }: Props) {
  const chartData = data.map((d) => ({ subject: d.label, value: d.value, max: d.max ?? 100 }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsRadarChart data={chartData}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="subject" stroke="var(--muted-foreground)" fontSize={11} />
        <PolarRadiusAxis stroke="var(--muted-foreground)" fontSize={10} />
        <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.3} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
