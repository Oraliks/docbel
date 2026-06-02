'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { donationSchema as schema } from './schemas'

export const donation = defineBlock({
  type: 'donation',
  schema,
  defaults: {
    title: 'Soutenir Docbel',
    description: 'Votre soutien aide à maintenir ce service gratuit.',
    presets: [5, 10, 20, 50],
    buttonText: 'Faire un don',
    link: '#',
  },
  meta: {
    name: 'Don / Soutien',
    description: 'Bouton de soutien avec presets',
    category: 'engagement',
    icon: 'heart',
    shortcuts: ['donation', 'don'],
  },
  Render: ({ props }) => {
    const { title = 'Soutenir le projet', description, presets, buttonText, link } = props
    const [amount, setAmount] = useState<number>(presets[0] ?? 10)
    const [custom, setCustom] = useState('')
    const finalAmount = custom ? Number(custom) : amount
    return (
      <div className="rounded-2xl border bg-card p-6 my-2 text-center">
        <Heart className="size-6 mx-auto text-primary mb-2" />
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setAmount(p)
                setCustom('')
              }}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                amount === p && !custom
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:border-primary'
              )}
            >
              {p}€
            </button>
          ))}
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Autre"
            className="w-24 rounded-full border px-4 py-2 text-sm text-center"
          />
        </div>
        <a
          href={safeHref(link)}
          className="mt-4 inline-block rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90"
        >
          {buttonText} {finalAmount}€
        </a>
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
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Montants prédéfinis (séparés par virgules)">
        <Input
          value={props.presets.join(', ')}
          onChange={(e) =>
            onChange({
              presets: e.target.value
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => !Number.isNaN(n) && n > 0),
            })
          }
          placeholder="5, 10, 20, 50"
        />
      </Field>
      <Field label="Texte du bouton">
        <Input
          value={props.buttonText}
          onChange={(e) => onChange({ buttonText: e.target.value })}
        />
      </Field>
      <Field label="Lien (paiement / mailto)">
        <Input
          value={props.link ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
