'use client'

import { z } from 'zod'
import { Eye, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { spoilerSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const spoiler = defineBlock({
  type: 'spoiler',
  schema,
  defaults: {
    summary: 'Cliquez pour révéler la réponse',
    content: 'Réponse cachée. Vous pouvez écrire plusieurs lignes ici.',
    variant: 'default',
  },
  meta: {
    name: 'Spoiler',
    description: 'Contenu masqué cliquable',
    category: 'text',
    icon: 'eye',
    shortcuts: ['spoiler', 'reveal'],
  },
  Render: ({ props }) => {
    const { summary, content, variant = 'default' } = props
    return (
      <details
        className={cn(
          'rounded-lg my-2 group',
          variant === 'subtle' ? 'border-l-4 border-primary pl-4 py-1' : 'border bg-card p-3'
        )}
      >
        <summary className="cursor-pointer font-medium flex items-center gap-2 list-none">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          <Eye className="size-4 text-muted-foreground" />
          {summary}
        </summary>
        <div className="mt-2 text-sm leading-relaxed">{content}</div>
      </details>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Résumé (cliquable)">
        <Input value={props.summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </Field>
      <Field label="Contenu caché">
        <Textarea
          value={props.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={4}
          className="resize-y"
        />
      </Field>
      <Field label="Variante">
        <Pills
          value={props.variant ?? 'default'}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'default', label: 'Carte' },
            { value: 'subtle', label: 'Subtil' },
          ]}
        />
      </Field>
    </Group>
  ),
})
