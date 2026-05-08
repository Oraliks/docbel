'use client'

import { useMemo } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { ColorControl, Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const dayPointSchema = z.object({
  date: z.string(),
  value: z.number(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  data: z.array(dayPointSchema).max(1000),
  color: z.string().optional(),
})

function generateSampleHeatmap() {
  const today = new Date()
  const out: { date: string; value: number }[] = []
  for (let i = 60; i >= 0; i -= 3) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), value: Math.floor(Math.random() * 5) + 1 })
  }
  return out
}

export const heatmap = defineBlock({
  type: 'heatmap',
  schema,
  defaults: {
    title: 'Activité',
    data: generateSampleHeatmap(),
    color: '#C8102E',
  },
  meta: {
    name: 'Heatmap calendrier',
    description: 'Activité quotidienne (style GitHub)',
    category: 'charts',
    icon: 'grid-2x2',
    shortcuts: ['heatmap'],
  },
  Render: ({ props }) => {
    const { title, data, color = '#C8102E' } = props
    const grid = useMemo(() => {
      const dayMap = new Map<string, number>()
      let max = 0
      for (const d of data) {
        dayMap.set(d.date, d.value)
        if (d.value > max) max = d.value
      }
      const today = new Date()
      const cols: { date: string; value: number; level: number }[][] = []
      let currentWeek: { date: string; value: number; level: number }[] = []
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
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <Field
        label="Données"
        hint="JSON: [{date: 'YYYY-MM-DD', value: number}, …]"
      >
        <textarea
          value={JSON.stringify(props.data, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value)
              if (Array.isArray(parsed)) onChange({ data: parsed })
            } catch {
              // ignore parse errors during typing
            }
          }}
          rows={6}
          className="w-full font-mono text-xs resize-y rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </Field>
    </Group>
  ),
})
