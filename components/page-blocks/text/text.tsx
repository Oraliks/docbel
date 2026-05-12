'use client'

import { z } from 'zod'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { RichTextInput } from '@/components/page-builder/inspector/rich-text-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { enrichHtmlWithAcronyms } from '@/lib/acronyms-html'
import { cn } from '@/lib/utils'

const schema = z.object({
  html: z.string().max(50000).default('<p>Commencez à écrire…</p>'),
  variant: z.enum(['default', 'lead', 'small']).optional(),
})

type Props = z.infer<typeof schema>

const VARIANT_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'text-base leading-relaxed',
  lead: 'text-lg md:text-xl leading-relaxed text-foreground/80',
  small: 'text-sm leading-relaxed text-muted-foreground',
}

export const text = defineBlock({
  type: 'text',
  schema,
  defaults: { html: '<p>Commencez à écrire…</p>', variant: 'default' },
  meta: {
    name: 'Texte',
    description: 'Paragraphe rich-text',
    category: 'text',
    icon: 'type',
    shortcuts: ['p', 'text', 'paragraphe'],
    variants: [
      { id: 'default', name: 'Standard' },
      { id: 'lead', name: 'Lead (large)' },
      { id: 'small', name: 'Petit' },
    ],
  },
  Render: ({ props }) => (
    <div
      className={cn('prose-tight max-w-none', VARIANT_CLASS[props.variant ?? 'default'])}
      dangerouslySetInnerHTML={{ __html: enrichHtmlWithAcronyms(props.html) }}
    />
  ),
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <RichTextInput
          value={props.html}
          onChange={(html) => onChange({ html })}
          placeholder="Commencez à écrire…"
        />
      </Field>
    </Group>
  ),
})
