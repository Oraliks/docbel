'use client'

import { PieChart as RPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { z } from 'zod'
import type { pieChartSchema } from './schemas'

type Props = z.infer<typeof pieChartSchema>

const COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

/** Rendu recharts du bloc pieChart — chargé en dynamic (hors bundle public). */
export function PieChartView({ data, donut, height = 300 }: Props) {
  return (
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
  )
}
