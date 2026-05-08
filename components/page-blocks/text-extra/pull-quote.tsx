'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const schema = z.object({
  text: z.string().max(2000).default(''),
  author: z.string().max(200).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

type Props = z.infer<typeof schema>

export const pullQuote = defineBlock({
  type: 'pullQuote',
  schema,
  defaults: {
    text: 'Une phrase forte qui mérite d\'être mise en valeur.',
    author: '',
    align: 'center',
  },
  meta: {
    name: 'Pull-quote',
    description: 'Citation typographique large',
    category: 'text',
    icon: 'quote',
    shortcuts: ['pullquote', 'pq'],
  },
  Render: ({ props }) => {
    const { text, author, align = 'center' } = props
    return (
      <blockquote
        className={cn(
          'my-8 px-6',
          align === 'left' && 'text-left border-l-4 border-primary pl-6',
          align === 'right' && 'text-right border-r-4 border-primary pr-6',
          align === 'center' && 'text-center'
        )}
      >
        <p className="text-2xl md:text-3xl lg:text-4xl font-medium leading-tight italic">
          “{text}”
        </p>
        {author && (
          <cite className="mt-4 block text-sm font-medium not-italic text-muted-foreground">
            — {author}
          </cite>
        )}
      </blockquote>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <Textarea value={props.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} />
      </Field>
      <Field label="Auteur">
        <Input value={props.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} />
      </Field>
      <Field label="Alignement">
        <Pills
          value={props.align ?? 'center'}
          onChange={(v) => onChange({ align: v as Props['align'] })}
          options={[
            { value: 'left', label: 'Gauche' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Droite' },
          ]}
        />
      </Field>
    </Group>
  ),
})
