'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  label: z.string().max(200).optional(),
  value: z.number().min(0).max(100).default(0),
  showValue: z.boolean().optional(),
  color: z.string().optional(),
  variant: z.enum(['default', 'segmented', 'circular']).optional(),
})

export const progress = defineBlock({
  type: 'progress',
  schema,
  defaults: {
    label: 'Progression',
    value: 60,
    showValue: true,
    color: '#7C3AED',
    variant: 'default',
  },
  meta: {
    name: 'Progression',
    description: 'Barre de progression',
    category: 'ui',
    icon: 'bar-chart-3',
    shortcuts: ['progress', 'progression'],
    variants: [
      { id: 'default', name: 'Linéaire' },
      { id: 'segmented', name: 'Segmentée' },
      { id: 'circular', name: 'Circulaire' },
    ],
  },
  Render: ({ props }) => {
    const { label, value, showValue = true, color, variant = 'default' } = props
    const v = Math.max(0, Math.min(100, value))

    if (variant === 'circular') {
      const r = 36
      const circ = 2 * Math.PI * r
      const offset = circ - (v / 100) * circ
      return (
        <div className="flex items-center gap-4">
          <div className="relative size-20">
            <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
              <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r={r}
                fill="none"
                stroke={color || 'var(--primary)'}
                strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
              {v}%
            </div>
          </div>
          {label && <div className="font-medium">{label}</div>}
        </div>
      )
    }

    if (variant === 'segmented') {
      const segments = 10
      const filled = Math.round((v / 100) * segments)
      return (
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            {label && <span className="font-medium">{label}</span>}
            {showValue && <span className="text-muted-foreground">{v}%</span>}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: segments }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-2 rounded transition-colors"
                style={{
                  backgroundColor: i < filled ? color || 'var(--primary)' : 'var(--muted)',
                }}
              />
            ))}
          </div>
        </div>
      )
    }

    return (
      <div>
        {(label || showValue) && (
          <div className="flex items-center justify-between mb-2 text-sm">
            {label && <span className="font-medium">{label}</span>}
            {showValue && <span className="text-muted-foreground">{v}%</span>}
          </div>
        )}
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${v}%`, backgroundColor: color || 'var(--primary)' }}
          />
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé">
        <Input
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Valeur">
        <SliderControl
          value={props.value}
          onChange={(v) => onChange({ value: v })}
          min={0}
          max={100}
          suffix="%"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Afficher la valeur" className="flex-1">
          <span className="sr-only">Show value</span>
        </Field>
        <Switch
          checked={props.showValue ?? true}
          onCheckedChange={(v) => onChange({ showValue: v })}
        />
      </div>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
    </Group>
  ),
})
