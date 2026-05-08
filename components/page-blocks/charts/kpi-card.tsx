'use client'

import { z } from 'zod'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  ColorControl,
  Field,
  Group,
} from '@/components/page-builder/inspector/controls'
import { IconPicker, renderIcon } from '@/components/page-builder/inspector/icon-picker'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  label: z.string().max(200).default(''),
  value: z.string().max(120).default(''),
  trendValue: z.number().optional(),
  trendLabel: z.string().max(120).optional(),
  color: z.string().optional(),
  icon: z.string().max(40).optional(),
})

export const kpiCard = defineBlock({
  type: 'kpiCard',
  schema,
  defaults: {
    label: 'Utilisateurs actifs',
    value: '12 458',
    trendValue: 12.5,
    trendLabel: 'vs mois dernier',
    icon: 'users',
  },
  meta: {
    name: 'KPI',
    description: 'Indicateur clé avec tendance',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['kpi'],
  },
  Render: ({ props }) => {
    const { label, value, trendValue, trendLabel, color, icon } = props
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
                  trendUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {trendUp ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {trendUp ? '+' : ''}
                {trendValue}%
                {trendLabel && (
                  <span className="ml-1 text-muted-foreground font-normal">{trendLabel}</span>
                )}
              </div>
            )}
          </div>
          {icon && <div className="text-primary/60">{renderIcon(icon, 'size-6')}</div>}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Libellé">
        <Input value={props.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>
      <Field label="Valeur">
        <Input
          value={props.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="12 458 ou €1.2M"
        />
      </Field>
      <Field label="Variation (%)">
        <Input
          type="number"
          step={0.1}
          value={props.trendValue ?? 0}
          onChange={(e) => onChange({ trendValue: Number(e.target.value) })}
        />
      </Field>
      <Field label="Étiquette de variation">
        <Input
          value={props.trendLabel ?? ''}
          onChange={(e) => onChange({ trendLabel: e.target.value })}
          placeholder="vs mois dernier"
        />
      </Field>
      <Field label="Icône">
        <IconPicker value={props.icon ?? ''} onChange={(icon) => onChange({ icon })} />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
    </Group>
  ),
})
