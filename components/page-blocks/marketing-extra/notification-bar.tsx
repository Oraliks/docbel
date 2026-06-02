'use client'

import { useState } from 'react'
import { z } from 'zod'
import { X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { notificationBarSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const STYLES: Record<NonNullable<Props['variant']>, string> = {
  info: 'bg-blue-500 text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-amber-950',
  destructive: 'bg-red-500 text-white',
}

export const notificationBar = defineBlock({
  type: 'notificationBar',
  schema,
  defaults: {
    message: 'Nouveau : découvrez notre nouvelle fonctionnalité !',
    ctaText: 'En savoir plus',
    ctaLink: '#',
    variant: 'info',
    dismissible: true,
  },
  meta: {
    name: 'Bandeau d\'annonce',
    description: 'Bandeau en haut de page',
    category: 'marketing',
    icon: 'bell',
    shortcuts: ['banner', 'announce', 'bandeau'],
  },
  Render: ({ props }) => {
    const { message, ctaText, ctaLink, variant = 'info', dismissible } = props
    const [closed, setClosed] = useState(false)
    if (closed) return null
    return (
      <div
        className={cn(
          'w-full py-2 px-4 my-2 rounded-lg flex items-center justify-center gap-3 text-sm',
          STYLES[variant]
        )}
      >
        <span>{message}</span>
        {ctaText && (
          <a href={safeHref(ctaLink)} className="underline font-medium hover:opacity-90">
            {ctaText}
          </a>
        )}
        {dismissible && (
          <button
            type="button"
            onClick={() => setClosed(true)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Message">
        <Textarea
          value={props.message}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Texte CTA">
        <Input
          value={props.ctaText ?? ''}
          onChange={(e) => onChange({ ctaText: e.target.value })}
        />
      </Field>
      <Field label="Lien CTA">
        <LinkInput
          value={props.ctaLink ?? ''}
          onChange={(ctaLink) => onChange({ ctaLink })}
        />
      </Field>
      <Field label="Variante">
        <Pills
          value={props.variant ?? 'info'}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'info', label: 'Info' },
            { value: 'success', label: 'Succès' },
            { value: 'warning', label: 'Attention' },
            { value: 'destructive', label: 'Erreur' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Fermable" className="flex-1">
          <span className="sr-only">dismissible</span>
        </Field>
        <Switch
          checked={props.dismissible ?? true}
          onCheckedChange={(v) => onChange({ dismissible: v })}
        />
      </div>
    </Group>
  ),
})
