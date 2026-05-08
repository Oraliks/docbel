'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  color: z.string().optional(),
  height: z.number().min(1).max(20).optional(),
})

export const readingProgress = defineBlock({
  type: 'readingProgress',
  schema,
  defaults: { color: '#C8102E', height: 3 },
  meta: {
    name: 'Barre de lecture',
    description: 'Progression de lecture sticky',
    category: 'navigation',
    icon: 'bar-chart-3',
    shortcuts: ['progress', 'reading'],
  },
  Render: ({ props }) => {
    const { color = '#C8102E', height = 3 } = props
    const [pct, setPct] = useState(0)
    useEffect(() => {
      const onScroll = () => {
        const total = document.documentElement.scrollHeight - window.innerHeight
        if (total <= 0) {
          setPct(0)
          return
        }
        setPct(Math.min(100, (window.scrollY / total) * 100))
      }
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }, [])
    return (
      <div className="fixed top-0 inset-x-0 z-50 pointer-events-none" style={{ height }}>
        <div
          className="h-full transition-[width] ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Apparence" defaultOpen>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <Field label="Hauteur">
        <SliderControl
          value={props.height ?? 3}
          onChange={(v) => onChange({ height: v })}
          min={1}
          max={10}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
