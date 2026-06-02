'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { allocationsFamilialesSchema as schema } from './schemas'

type Region = 'wallonie' | 'bruxelles' | 'flandre'

const RATES: Record<Region, number[]> = {
  wallonie: [167, 167, 167],
  bruxelles: [157, 157, 157],
  flandre: [184, 184, 184],
}

export const allocationsFamiliales = defineBlock({
  type: 'allocationsFamiliales',
  schema,
  defaults: { title: 'Allocations familiales', region: 'wallonie' },
  meta: {
    name: 'Allocations familiales',
    description: 'Estimation par région',
    category: 'docbel',
    icon: 'heart',
    shortcuts: ['allocations', 'famille'],
  },
  Render: ({ props }) => {
    const { title = 'Allocations familiales', region = 'wallonie' } = props
    const [r, setR] = useState<Region>(region)
    const [count, setCount] = useState(2)
    const total = Array.from({ length: count }, (_, i) => RATES[r][Math.min(i, 2)] || 0).reduce(
      (a, b) => a + b,
      0
    )

    return (
      <div className="rounded-2xl border bg-card p-6 my-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Estimation simplifiée — montants de base 2024
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Région</label>
            <select
              value={r}
              onChange={(e) => setR(e.target.value as Region)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="wallonie">Wallonie</option>
              <option value="bruxelles">Bruxelles</option>
              <option value="flandre">Flandre</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Nombre d&apos;enfants</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-primary/10 p-4 text-center border-2 border-primary">
          <div className="text-xs uppercase text-primary font-semibold">Estimation mensuelle</div>
          <div className="mt-1 text-3xl font-bold text-primary tabular-nums">
            {total.toLocaleString('fr-FR')} €
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
      <Field label="Région par défaut">
        <Pills
          value={props.region}
          onChange={(v) => onChange({ region: v as Region })}
          options={[
            { value: 'wallonie', label: 'Wallonie' },
            { value: 'bruxelles', label: 'Bruxelles' },
            { value: 'flandre', label: 'Flandre' },
          ]}
        />
      </Field>
    </Group>
  ),
})
