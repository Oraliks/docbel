'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  text: z.string().max(2000).default('Une citation inspirante.'),
  author: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  variant: z.enum(['simple', 'pull', 'card']).optional(),
})

type Props = z.infer<typeof schema>

export const quote = defineBlock({
  type: 'quote',
  schema,
  defaults: {
    text: 'Une citation inspirante.',
    author: 'Nom',
    role: 'Fonction',
    variant: 'simple',
  },
  meta: {
    name: 'Citation',
    description: 'Bloc de citation avec auteur',
    category: 'text',
    icon: 'quote',
    shortcuts: ['quote', 'citation'],
    variants: [
      { id: 'simple', name: 'Simple' },
      { id: 'pull', name: 'Pull-quote' },
      { id: 'card', name: 'Carte' },
    ],
  },
  Render: ({ props }) => {
    const { text, author, role, variant = 'simple' } = props
    const footer = (author || role) && (
      <footer className="mt-2 text-sm text-muted-foreground not-italic">
        <span className="font-medium text-foreground">{author}</span>
        {role && <span>, {role}</span>}
      </footer>
    )

    if (variant === 'pull') {
      return (
        <blockquote className="border-l-4 border-primary pl-6 py-2 my-4">
          <p className="text-2xl md:text-3xl font-medium leading-snug">“{text}”</p>
          {footer}
        </blockquote>
      )
    }
    if (variant === 'card') {
      return (
        <blockquote className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
          <p className="text-lg md:text-xl leading-relaxed">“{text}”</p>
          {footer}
        </blockquote>
      )
    }
    return (
      <blockquote className="border-l-2 border-primary pl-4 italic">
        <p className="text-base md:text-lg leading-relaxed">“{text}”</p>
        {footer}
      </blockquote>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Citation">
        <Textarea
          value={props.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Auteur">
        <Input value={props.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} />
      </Field>
      <Field label="Fonction">
        <Input value={props.role ?? ''} onChange={(e) => onChange({ role: e.target.value })} />
      </Field>
    </Group>
  ),
})

export type { Props as QuoteProps }
