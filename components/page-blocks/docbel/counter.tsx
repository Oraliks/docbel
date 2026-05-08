'use client'

import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  Pills,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  value: z.number(),
  label: z.string().max(200),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
})

const schema = z.object({
  title: z.string().max(500).optional(),
  items: z.array(itemSchema).max(12),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  duration: z.number().min(100).max(10000).optional(),
})

type Props = z.infer<typeof schema>
type Item = Props['items'][number]

const COLS: Record<Props['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-4',
}

function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function AnimatedNumber({ value, duration }: { value: number; duration: number }) {
  const { ref, inView } = useInView()
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])
  return <span ref={ref}>{display.toLocaleString('fr-FR')}</span>
}

export const counter = defineBlock({
  type: 'counter',
  schema,
  defaults: {
    title: '',
    items: [
      { value: 1000, label: 'Utilisateurs', suffix: '+' },
      { value: 99, label: 'Satisfaction', suffix: '%' },
      { value: 24, label: 'Support', suffix: '/7' },
    ],
    columns: 3,
    duration: 2000,
  },
  meta: {
    name: 'Compteur animé',
    description: 'Statistiques avec animation au scroll',
    category: 'docbel',
    icon: 'bar-chart-3',
    shortcuts: ['counter', 'compteur'],
  },
  Render: ({ props }) => {
    const { title, items, columns, duration = 2000 } = props
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-7xl px-6">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
              {title}
            </h2>
          )}
          <div className={cn('grid grid-cols-1 gap-6', COLS[columns])}>
            {items.map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                  {item.prefix}
                  <AnimatedNumber value={item.value} duration={duration} />
                  {item.suffix}
                </div>
                <div className="mt-2 text-sm text-muted-foreground uppercase tracking-wider">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Colonnes">
          <Pills
            value={props.columns}
            onChange={(v) => onChange({ columns: v as Props['columns'] })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
        <Field label="Durée d’animation (ms)">
          <SliderControl
            value={props.duration ?? 2000}
            onChange={(v) => onChange({ duration: v })}
            min={500}
            max={5000}
            step={100}
            suffix="ms"
          />
        </Field>
      </Group>
      <Group title={`Compteurs (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={item.prefix ?? ''}
                  onChange={(e) => set({ prefix: e.target.value })}
                  placeholder="Préf."
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  value={item.value}
                  onChange={(e) => set({ value: Number(e.target.value) })}
                  placeholder="100"
                  className="h-8 text-xs"
                />
                <Input
                  value={item.suffix ?? ''}
                  onChange={(e) => set({ suffix: e.target.value })}
                  placeholder="Suff."
                  className="h-8 text-xs"
                />
              </div>
              <Input
                value={item.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="Libellé"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ value: 0, label: 'Nouvelle métrique' })}
        />
      </Group>
    </>
  ),
})
