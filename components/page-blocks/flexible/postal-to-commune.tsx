'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  title: z.string().max(500).optional(),
  defaultCode: z.string().default('1000'),
})

const POSTAL_BE: Record<string, { commune: string; province: string }> = {
  '1000': { commune: 'Bruxelles', province: 'Bruxelles-Capitale' },
  '1050': { commune: 'Ixelles', province: 'Bruxelles-Capitale' },
  '1060': { commune: 'Saint-Gilles', province: 'Bruxelles-Capitale' },
  '1180': { commune: 'Uccle', province: 'Bruxelles-Capitale' },
  '4000': { commune: 'Liège', province: 'Liège' },
  '5000': { commune: 'Namur', province: 'Namur' },
  '6000': { commune: 'Charleroi', province: 'Hainaut' },
  '7000': { commune: 'Mons', province: 'Hainaut' },
  '8000': { commune: 'Bruges', province: 'Flandre-Occidentale' },
  '9000': { commune: 'Gand', province: 'Flandre-Orientale' },
  '2000': { commune: 'Anvers', province: 'Anvers' },
  '3000': { commune: 'Louvain', province: 'Brabant flamand' },
  '1300': { commune: 'Wavre', province: 'Brabant wallon' },
}

export const postalToCommune = defineBlock({
  type: 'postalToCommune',
  schema,
  defaults: { title: 'Trouver ma commune', defaultCode: '1000' },
  meta: {
    name: 'Code postal → commune',
    description: 'Trouve la commune belge',
    category: 'docbel',
    icon: 'map-pin',
    shortcuts: ['postal', 'cp', 'commune'],
  },
  Render: ({ props }) => {
    const { title = 'Trouver ma commune', defaultCode = '1000' } = props
    const [code, setCode] = useState(defaultCode)
    const result = POSTAL_BE[code]
    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        <h3 className="font-semibold mb-3">{title}</h3>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Code postal (ex. 1000)"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono"
            maxLength={4}
          />
        </div>
        {result ? (
          <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
            <div className="font-bold text-primary">{result.commune}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{result.province}</div>
          </div>
        ) : code.length === 4 ? (
          <p className="mt-3 text-xs text-muted-foreground italic">
            Code postal non trouvé dans la liste de démonstration. Essayez 1000, 4000, 9000…
          </p>
        ) : null}
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
      <Field label="Code postal par défaut">
        <Input
          value={props.defaultCode}
          onChange={(e) => onChange({ defaultCode: e.target.value })}
          maxLength={4}
          className="font-mono"
        />
      </Field>
    </Group>
  ),
})
