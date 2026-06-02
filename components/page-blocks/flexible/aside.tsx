'use client'

import type { ElementType } from 'react'
import { z } from 'zod'
import { Info, Lightbulb, AlertTriangle, StickyNote } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { asideSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const STYLES: Record<NonNullable<Props['variant']>, { class: string; Icon: ElementType; label: string }> = {
  info: {
    class: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200',
    Icon: Info,
    label: 'Info',
  },
  tip: {
    class: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200',
    Icon: Lightbulb,
    label: 'Astuce',
  },
  warning: {
    class: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200',
    Icon: AlertTriangle,
    label: 'Attention',
  },
  note: { class: 'border-primary/30 bg-primary/5', Icon: StickyNote, label: 'Note' },
}

export const aside = defineBlock({
  type: 'aside',
  schema,
  defaults: {
    title: 'Bon à savoir',
    content: 'Information complémentaire utile au lecteur.',
    variant: 'info',
  },
  meta: {
    name: 'Encart',
    description: 'Note latérale (info/tip/warning)',
    category: 'text',
    icon: 'help-circle',
    shortcuts: ['aside', 'note', 'tip'],
  },
  Render: ({ props }) => {
    const { title, content, variant = 'info' } = props
    const style = STYLES[variant]
    const Icon = style.Icon
    return (
      <aside className={cn('rounded-lg border-l-4 p-4 my-2', style.class)}>
        <div className="flex items-start gap-3">
          <Icon className="size-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm uppercase tracking-wider">
              {title || style.label}
            </div>
            <p className="mt-1 text-sm leading-relaxed">{content}</p>
          </div>
        </div>
      </aside>
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
      <Field label="Contenu">
        <Textarea
          value={props.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Variante">
        <Pills
          value={props.variant ?? 'info'}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'info', label: 'Info' },
            { value: 'tip', label: 'Astuce' },
            { value: 'warning', label: 'Attention' },
            { value: 'note', label: 'Note' },
          ]}
        />
      </Field>
    </Group>
  ),
})
