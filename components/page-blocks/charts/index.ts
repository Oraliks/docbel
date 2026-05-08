import { barChart } from './bar-chart'
import { lineChart } from './line-chart'
import { pieChart } from './pie-chart'
import { kpiCard } from './kpi-card'
import { sparkline } from './sparkline'
import { heatmap } from './heatmap'
import { chronology } from './chronology'

export const chartsBlocks = {
  barChart,
  lineChart,
  pieChart,
  kpiCard,
  sparkline,
  heatmap,
  chronology,
} as const
