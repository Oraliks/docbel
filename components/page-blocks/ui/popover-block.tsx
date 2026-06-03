'use client'

import { z } from 'zod'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RichTextInput } from '@/components/page-builder/inspector/rich-text-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { popoverSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const TRIGGER_VARIANT: Record<NonNullable<Props['triggerVariant']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-foreground text-background hover:opacity-90',
  outline: 'border border-current bg-transparent hover:bg-foreground/5',
  ghost: 'bg-transparent hover:bg-foreground/5',
  link: 'bg-transparent underline-offset-4 hover:underline',
}
const TRIGGER_SIZE: Record<NonNullable<Props['triggerSize']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const popoverBlock = defineBlock({
  type: 'popover',
  schema,
  defaults: {
    triggerText: 'Plus d’infos',
    triggerVariant: 'outline',
    triggerSize: 'md',
    align: 'center',
    title: '',
    content: '<p>Contenu de l’infobulle.</p>',
  },
  meta: {
    name: 'Infobulle (popover)',
    description: 'Bouton qui ouvre une bulle d’info',
    category: 'ui',
    icon: 'message-square',
    shortcuts: ['popover', 'infobulle', 'tooltip'],
  },
  Render: ({ props }) => {
    const {
      triggerText = 'Plus d’infos',
      triggerVariant = 'primary',
      triggerSize = 'md',
      align = 'center',
      title,
      content,
    } = props
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg font-medium transition cursor-pointer',
              TRIGGER_VARIANT[triggerVariant],
              triggerVariant === 'link' ? '' : TRIGGER_SIZE[triggerSize]
            )}
          >
            {triggerText}
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-80">
          {title && <div className="mb-1 text-sm font-semibold">{title}</div>}
          {content && (
            <div
              className="prose prose-sm prose-neutral max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          )}
        </PopoverContent>
      </Popover>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte du bouton">
        <Input
          value={props.triggerText ?? ''}
          onChange={(e) => onChange({ triggerText: e.target.value })}
        />
      </Field>
      <Field label="Style du bouton">
        <Pills
          value={props.triggerVariant ?? 'primary'}
          onChange={(v) => onChange({ triggerVariant: v as Props['triggerVariant'] })}
          options={[
            { value: 'primary', label: 'Primary' },
            { value: 'outline', label: 'Outline' },
            { value: 'ghost', label: 'Ghost' },
            { value: 'link', label: 'Lien' },
          ]}
        />
      </Field>
      <Field label="Alignement">
        <Pills
          value={props.align ?? 'center'}
          onChange={(v) => onChange({ align: v as Props['align'] })}
          options={[
            { value: 'start', label: 'Début' },
            { value: 'center', label: 'Centre' },
            { value: 'end', label: 'Fin' },
          ]}
        />
      </Field>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Contenu">
        <RichTextInput
          value={props.content ?? ''}
          onChange={(html) => onChange({ content: html })}
        />
      </Field>
    </Group>
  ),
})
