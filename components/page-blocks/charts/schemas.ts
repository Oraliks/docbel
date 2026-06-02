import { z } from 'zod'

const barChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const barChartSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(barChartDataPointSchema).max(100),
  color: z.string().optional(),
  horizontal: z.boolean().optional(),
  height: z.number().min(50).max(2000).optional(),
})

const lineChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const lineChartSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(lineChartDataPointSchema).max(100),
  color: z.string().optional(),
  smooth: z.boolean().optional(),
  height: z.number().min(50).max(2000).optional(),
})

const pieChartDataPointSchema = z.object({
  label: z.string(),
  value: z.number(),
})

export const pieChartSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(pieChartDataPointSchema).max(50),
  donut: z.boolean().optional(),
  height: z.number().min(50).max(2000).optional(),
})

export const kpiCardSchema = z.object({
  label: z.string().max(200).default(''),
  value: z.string().max(120).default(''),
  trendValue: z.number().optional(),
  trendLabel: z.string().max(120).optional(),
  color: z.string().optional(),
  icon: z.string().max(40).optional(),
})

export const sparklineSchema = z.object({
  data: z.array(z.number()).max(500),
  color: z.string().optional(),
  label: z.string().max(200).optional(),
  value: z.string().max(120).optional(),
})

const heatmapDayPointSchema = z.object({
  date: z.string(),
  value: z.number(),
})

export const heatmapSchema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(heatmapDayPointSchema).max(1000),
  color: z.string().optional(),
})

const chronologyEventSchema = z.object({
  date: z.string().max(120),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  icon: z.string().max(40).optional(),
})

export const chronologySchema = z.object({
  title: z.string().max(500).optional(),
  events: z.array(chronologyEventSchema).max(50),
  variant: z.enum(['vertical', 'horizontal']).optional(),
})

export const chartsSchemas = {
  barChart: barChartSchema,
  lineChart: lineChartSchema,
  pieChart: pieChartSchema,
  kpiCard: kpiCardSchema,
  sparkline: sparklineSchema,
  heatmap: heatmapSchema,
  chronology: chronologySchema,
} as const
