'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type {
  BarChartProps,
  LineChartProps,
  PieChartProps,
  KpiCardProps,
  SparklineProps,
  HeatmapProps,
  ChronologyProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { renderIcon } from '@/components/page-builder/inspector/icon-picker'

const CHART_COLORS = ['#C8102E', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

// ─────────────────────────── Bar Chart ───────────────────────────

export function BarChartBlock({ title, data, color = '#C8102E', horizontal, height = 300 }: BarChartProps) {
  return (
    <div className="w-full my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            {horizontal ? (
              <>
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis dataKey="label" type="category" stroke="var(--muted-foreground)" fontSize={12} />
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
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────── Line Chart ───────────────────────────

export function LineChartBlock({ title, data, color = '#C8102E', smooth = true, height = 300 }: LineChartProps) {
  return (
    <div className="w-full my-2">
      {title && <h3 className="text-lg font-semibold mb-3">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────── Pie / Donut Chart ───────────────────────────

export function PieChartBlock({ title, data, donut, height = 300 }: PieChartProps) {
  return (
    <div className="w-full my-2">
      {title && <h3 className="text-lg font-semibold mb-3 text-center">{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
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
                <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────── KPI Card ───────────────────────────

export function KpiCardBlock({ label, value, trendValue, trendLabel, color, icon }: KpiCardProps) {
  const trendUp = (trendValue ?? 0) >= 0
  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div
            className="mt-1 text-3xl md:text-4xl font-bold tracking-tight"
            style={{ color: color || undefined }}
          >
            {value}
          </div>
          {trendValue !== undefined && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium',
                trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              {trendUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {trendUp ? '+' : ''}
              {trendValue}%
              {trendLabel && <span className="ml-1 text-muted-foreground font-normal">{trendLabel}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className="text-primary/60">{renderIcon(icon, 'size-6')}</div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Sparkline ───────────────────────────

export function SparklineBlock({ data, color = '#C8102E', label, value }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="rounded-2xl border bg-card p-4 my-2">
      <div className="flex items-end justify-between">
        <div>
          {label && <div className="text-xs text-muted-foreground">{label}</div>}
          {value && <div className="text-2xl font-bold">{value}</div>}
        </div>
        <div style={{ width: 120, height: 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Heatmap calendar ───────────────────────────

export function HeatmapBlock({ title, data, color = '#C8102E' }: HeatmapProps) {
  // Group by week: each week is an array of 7 days (sun-sat)
  // We render 53 columns × 7 rows
  const grid = React.useMemo(() => {
    const dayMap = new Map<string, number>()
    let max = 0
    for (const d of data) {
      dayMap.set(d.date, d.value)
      if (d.value > max) max = d.value
    }
    const today = new Date()
    const cols: { date: string; value: number; level: number }[][] = []
    let currentWeek: { date: string; value: number; level: number }[] = []
    // Start 364 days back, go up to today
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const iso = d.toISOString().slice(0, 10)
      const v = dayMap.get(iso) ?? 0
      const level = max === 0 ? 0 : Math.min(4, Math.floor((v / max) * 4))
      currentWeek.push({ date: iso, value: v, level })
      if (d.getDay() === 6) {
        cols.push(currentWeek)
        currentWeek = []
      }
    }
    if (currentWeek.length > 0) cols.push(currentWeek)
    return cols
  }, [data])

  const colorWithOpacity = (level: number) => {
    if (level === 0) return 'var(--muted)'
    const opacities = [0.2, 0.4, 0.6, 0.85, 1]
    return color + Math.round(opacities[level] * 255).toString(16).padStart(2, '0')
  }

  return (
    <div className="w-full my-2 overflow-x-auto">
      {title && <h3 className="text-sm font-semibold mb-3">{title}</h3>}
      <div className="inline-block">
        <div className="flex gap-[2px]">
          {grid.map((week, ci) => (
            <div key={ci} className="flex flex-col gap-[2px]">
              {week.map((day, ri) => (
                <div
                  key={ri}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colorWithOpacity(day.level) }}
                  title={`${day.date}: ${day.value}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          Moins
          {[0, 1, 2, 3, 4].map((l) => (
            <div
              key={l}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: colorWithOpacity(l) }}
            />
          ))}
          Plus
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Chronology ───────────────────────────

export function ChronologyBlock({ title, events, variant = 'vertical' }: ChronologyProps) {
  if (variant === 'horizontal') {
    return (
      <div className="w-full my-4">
        {title && <h3 className="text-2xl font-bold tracking-tight mb-6">{title}</h3>}
        <div className="relative overflow-x-auto pb-4">
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-border" />
          <div className="relative flex gap-8 min-w-max">
            {events.map((ev, i) => (
              <div key={i} className="flex flex-col items-center text-center w-48 shrink-0">
                <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold relative z-10">
                  {ev.icon ? renderIcon(ev.icon, 'size-5') : i + 1}
                </div>
                <div className="mt-3 text-xs font-bold text-primary">{ev.date}</div>
                <h4 className="mt-1 font-semibold text-sm">{ev.title}</h4>
                {ev.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{ev.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full my-4">
      {title && <h3 className="text-2xl font-bold tracking-tight mb-6">{title}</h3>}
      <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-2">
        {events.map((ev, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[34px] flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold ring-4 ring-background">
              {ev.icon ? renderIcon(ev.icon, 'size-4') : i + 1}
            </span>
            <div className="text-xs font-bold text-primary mb-0.5">{ev.date}</div>
            <h4 className="font-semibold">{ev.title}</h4>
            {ev.description && (
              <p className="mt-1 text-sm text-muted-foreground">{ev.description}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
