'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { mathLatexSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const mathLatex = defineBlock({
  type: 'mathLatex',
  schema,
  defaults: { formula: 'a² + b² = c²', display: 'block' },
  meta: {
    name: 'Formule LaTeX',
    description: 'Équation mathématique (rendu basique)',
    category: 'text',
    icon: 'help-circle',
    shortcuts: ['math', 'latex'],
  },
  Render: ({ props }) => {
    const { formula, display = 'block' } = props
    if (display === 'inline') {
      return <span className="font-mono italic mx-1">{formula}</span>
    }
    return (
      <div className="my-2 rounded-lg border bg-muted/50 px-6 py-4 text-center font-mono text-lg italic">
        {formula}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Formule">
        <Input value={props.formula} onChange={(e) => onChange({ formula: e.target.value })} />
      </Field>
      <Field label="Affichage">
        <Pills
          value={props.display ?? 'block'}
          onChange={(v) => onChange({ display: v as Props['display'] })}
          options={[
            { value: 'block', label: 'Bloc' },
            { value: 'inline', label: 'Inline' },
          ]}
        />
      </Field>
    </Group>
  ),
})
