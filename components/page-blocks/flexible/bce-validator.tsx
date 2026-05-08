'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Check, X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  title: z.string().max(500).optional(),
})

export const bceValidator = defineBlock({
  type: 'bceValidator',
  schema,
  defaults: { title: 'Vérifier un numéro BCE/KBO' },
  meta: {
    name: 'Validateur BCE/KBO',
    description: 'Vérifie un n° d\'entreprise belge',
    category: 'docbel',
    icon: 'check',
    shortcuts: ['bce', 'kbo', 'tva'],
  },
  Render: ({ props }) => {
    const { title = 'Vérifier un numéro BCE/KBO' } = props
    const [num, setNum] = useState('')
    const cleaned = num.replace(/\D/g, '')
    const validFormat = /^[01]\d{9}$/.test(cleaned)
    let validChecksum = false
    if (validFormat) {
      const base = parseInt(cleaned.slice(0, 8), 10)
      const check = parseInt(cleaned.slice(8, 10), 10)
      validChecksum = 97 - (base % 97) === check
    }
    const formatted =
      cleaned.length >= 10
        ? `${cleaned.slice(0, 4)}.${cleaned.slice(4, 7)}.${cleaned.slice(7, 10)}`
        : cleaned
    return (
      <div className="rounded-2xl border bg-card p-5 my-2">
        <h3 className="font-semibold mb-3">{title}</h3>
        <input
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="0XXX.XXX.XXX"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
        />
        {cleaned.length === 10 ? (
          <div
            className={cn(
              'mt-3 rounded-lg p-3 text-sm flex items-center gap-2',
              validChecksum
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200'
            )}
          >
            {validChecksum ? <Check className="size-4" /> : <XIcon className="size-4" />}
            <div>
              <div className="font-medium">{formatted}</div>
              <div className="text-xs opacity-80">
                {validChecksum
                  ? 'Numéro valide (checksum OK)'
                  : 'Numéro invalide (checksum faux)'}
              </div>
            </div>
          </div>
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
    </Group>
  ),
})
