'use client'

import dynamic from 'next/dynamic'
import { ChartBlockFallback } from '../_chart-fallback'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { gaugeSchema as schema } from './schemas'

// recharts chargé en dynamic → hors bundle public. L'overlay valeur (%) reste
// rendu par le bloc ; seul l'arc recharts est différé.
const GaugeView = dynamic(
  () => import('./gauge-view').then((m) => ({ default: m.GaugeView })),
  { ssr: false, loading: () => <ChartBlockFallback /> }
)

export const gauge = defineBlock({
  type: 'gauge',
  schema,
  defaults: { label: 'Score', value: 75, color: '#7C3AED', showValue: true },
  meta: {
    name: 'Jauge',
    description: 'Indicateur en arc de cercle',
    category: 'charts',
    icon: 'bar-chart-3',
    shortcuts: ['gauge', 'jauge'],
  },
  Render: ({ props }) => {
    const { label, value, showValue = true } = props
    const v = Math.max(0, Math.min(100, value))
    return (
      <div className="my-2 inline-block w-48">
        {label && (
          <div className="text-center text-xs font-medium text-muted-foreground mb-1">
            {label}
          </div>
        )}
        <div className="relative" style={{ height: 130 }}>
          <GaugeView {...props} />
          {showValue && (
            <div className="absolute inset-x-0 bottom-2 text-center text-2xl font-bold">
              {v}%
            </div>
          )}
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
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
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
    </Group>
  ),
})
