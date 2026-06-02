'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { legalDelaySchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const legalDelay = defineBlock({
  type: 'legalDelay',
  schema,
  defaults: {
    delay: '30 jours',
    context: 'pour introduire un recours',
    variant: 'large',
  },
  meta: {
    name: 'Délai légal',
    description: 'Affichage gros chiffre + contexte',
    category: 'docbel',
    icon: 'clock',
    shortcuts: ['delai', 'delay'],
  },
  Render: ({ props }) => {
    const { delay, context, variant = 'large' } = props
    if (variant === 'inline') {
      return (
        <p className="my-2 inline-flex items-center gap-2 rounded-full border border-primary bg-primary/5 px-3 py-1 text-sm">
          <span className="font-bold text-primary">{delay}</span>
          <span className="text-muted-foreground">{context}</span>
        </p>
      )
    }
    return (
      <div className="rounded-2xl border-2 border-primary bg-primary/5 p-6 my-2 text-center">
        <div className="text-5xl md:text-6xl font-bold tracking-tight text-primary">{delay}</div>
        <p className="mt-2 text-sm text-muted-foreground">{context}</p>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Délai">
        <Input
          value={props.delay}
          onChange={(e) => onChange({ delay: e.target.value })}
          placeholder="30 jours"
        />
      </Field>
      <Field label="Contexte">
        <Input
          value={props.context}
          onChange={(e) => onChange({ context: e.target.value })}
          placeholder="pour répondre à une décision"
        />
      </Field>
      <Field label="Variant">
        <Pills
          value={props.variant ?? 'large'}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'large', label: 'Large' },
            { value: 'inline', label: 'Inline' },
          ]}
        />
      </Field>
    </Group>
  ),
})
