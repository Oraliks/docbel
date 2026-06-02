'use client'

import { useState, type ElementType } from 'react'
import { z } from 'zod'
import { Info, CheckCircle2, AlertTriangle, XCircle, X as CloseIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { alertSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const STYLES: Record<NonNullable<Props['variant']>, { class: string; icon: ElementType }> = {
  info: {
    class:
      'border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900',
    icon: Info,
  },
  success: {
    class:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  warning: {
    class:
      'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900',
    icon: AlertTriangle,
  },
  destructive: {
    class:
      'border-red-200 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900',
    icon: XCircle,
  },
}

export const alert = defineBlock({
  type: 'alert',
  schema,
  defaults: {
    title: 'Information importante',
    message: 'Voici un message à mettre en évidence.',
    variant: 'info',
    dismissible: false,
    icon: 'info',
  },
  meta: {
    name: 'Alerte',
    description: 'Message d’information ou avertissement',
    category: 'ui',
    icon: 'help-circle',
    shortcuts: ['alert', 'info', 'warning', 'avertissement'],
    variants: [
      { id: 'info', name: 'Info' },
      { id: 'success', name: 'Succès' },
      { id: 'warning', name: 'Attention' },
      { id: 'destructive', name: 'Erreur' },
    ],
  },
  Render: ({ props }) => {
    const { title, message, variant = 'info', dismissible } = props
    const [closed, setClosed] = useState(false)
    if (closed) return null
    const style = STYLES[variant]
    const Icon = style.icon
    return (
      <div className={cn('relative flex gap-3 rounded-lg border px-4 py-3', style.class)}>
        <Icon className="size-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {title && <div className="font-semibold text-sm">{title}</div>}
          <div className={cn('text-sm leading-relaxed', title && 'mt-0.5 opacity-90')}>
            {message}
          </div>
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={() => setClosed(true)}
            className="opacity-60 hover:opacity-100 transition shrink-0"
            aria-label="Fermer"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre (optionnel)">
        <Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Message">
        <Textarea
          value={props.message}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Fermable" className="flex-1">
          <span className="sr-only">Dismissible</span>
        </Field>
        <Switch
          checked={props.dismissible ?? false}
          onCheckedChange={(v) => onChange({ dismissible: v })}
        />
      </div>
    </Group>
  ),
})
