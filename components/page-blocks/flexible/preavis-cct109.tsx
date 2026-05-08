'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  title: z.string().max(500).optional(),
  defaultMonths: z.number().default(24),
})

function calcWeeks(m: number): number {
  if (m < 3) return 1
  if (m < 6) return 3
  if (m < 9) return 6
  if (m < 12) return 7
  if (m < 15) return 8
  if (m < 18) return 9
  if (m < 21) return 10
  if (m < 24) return 11
  const years = Math.floor(m / 12)
  if (years <= 21) return 12 + (years - 2) * 3
  return 62 + (years - 20)
}

export const preavisCCT109 = defineBlock({
  type: 'preavisCCT109',
  schema,
  defaults: { title: 'Calculateur de préavis', defaultMonths: 24 },
  meta: {
    name: 'Préavis CCT 109',
    description: 'Calcul du préavis selon ancienneté (Belgique)',
    category: 'docbel',
    icon: 'clock',
    shortcuts: ['preavis', 'cct'],
  },
  Render: ({ props }) => {
    const { title = 'Calculateur de préavis (CCT 109)', defaultMonths = 24 } = props
    const [months, setMonths] = useState(defaultMonths)
    const weeks = calcWeeks(months)
    const years = Math.floor(months / 12)
    const remMonths = months % 12

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Estimation pour licenciement par l&apos;employeur · CCT 109 / Loi du 26 décembre 2013
        </p>
        <div>
          <label className="text-sm font-medium">Ancienneté (en mois)</label>
          <input
            type="range"
            min={0}
            max={480}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="mt-1 w-full"
          />
          <div className="text-xs text-muted-foreground tabular-nums mt-1">
            {years} an{years > 1 ? 's' : ''} {remMonths > 0 && `et ${remMonths} mois`}
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-primary/10 p-5 text-center border-2 border-primary">
          <div className="text-xs uppercase tracking-wider text-primary font-semibold">
            Délai de préavis
          </div>
          <div className="mt-1 text-4xl font-bold text-primary tabular-nums">{weeks}</div>
          <div className="text-sm text-muted-foreground">semaines</div>
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
      <Field label="Ancienneté par défaut (mois)">
        <Input
          type="number"
          min={0}
          max={480}
          value={props.defaultMonths}
          onChange={(e) => onChange({ defaultMonths: Number(e.target.value) })}
        />
      </Field>
    </Group>
  ),
})
