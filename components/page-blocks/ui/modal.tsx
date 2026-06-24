'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RichTextInput } from '@/components/page-builder/inspector/rich-text-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { modalSchema as schema } from './schemas'

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
const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

function ModalView({
  triggerText,
  triggerVariant = 'primary',
  triggerSize = 'md',
  hideTrigger,
  modalId,
  title,
  description,
  content,
  size = 'md',
}: Props) {
  const t = useTranslations('public.blocks')
  const [open, setOpen] = useState(false)
  const triggerTextResolved = triggerText ?? t('modal.triggerFallback')

  // Allow other blocks' "Ouvrir une modale" action to open this one by id.
  useEffect(() => {
    if (!modalId) return
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id
      if (id === modalId) setOpen(true)
    }
    window.addEventListener('beldoc:open-modal', handler as EventListener)
    return () => window.removeEventListener('beldoc:open-modal', handler as EventListener)
  }, [modalId])

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg font-medium transition cursor-pointer',
            TRIGGER_VARIANT[triggerVariant],
            triggerVariant === 'link' ? '' : TRIGGER_SIZE[triggerSize]
          )}
        >
          {triggerTextResolved}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={SIZE_CLASS[size]}>
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </DialogHeader>
          )}
          {content && (
            <div
              className="prose prose-sm prose-neutral max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export const modal = defineBlock({
  type: 'modal',
  schema,
  defaults: {
    triggerText: 'Ouvrir la fenêtre',
    triggerVariant: 'primary',
    triggerSize: 'md',
    title: 'Titre de la fenêtre',
    description: '',
    content: '<p>Contenu de la fenêtre modale.</p>',
    size: 'md',
  },
  meta: {
    name: 'Fenêtre modale',
    description: 'Bouton qui ouvre une fenêtre (modal)',
    category: 'ui',
    icon: 'square-stack',
    shortcuts: ['modal', 'fenetre', 'popup', 'dialog'],
  },
  Render: ({ props }) => <ModalView {...props} />,
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Déclencheur" defaultOpen>
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
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Masquer le bouton (ouvrir via action)" className="flex-1">
            <span className="sr-only">Masquer le déclencheur</span>
          </Field>
          <Switch
            checked={props.hideTrigger ?? false}
            onCheckedChange={(v) => onChange({ hideTrigger: v })}
          />
        </div>
        <Field
          label="ID de la modale"
          hint="Pour l'ouvrir depuis une action « Ouvrir une modale »"
        >
          <Input
            value={props.modalId ?? ''}
            onChange={(e) => onChange({ modalId: e.target.value })}
            placeholder="ex: contact"
            className="font-mono text-xs"
          />
        </Field>
      </Group>
      <Group title="Contenu" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Sous-titre">
          <Input
            value={props.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>
        <Field label="Contenu">
          <RichTextInput
            value={props.content ?? ''}
            onChange={(html) => onChange({ content: html })}
          />
        </Field>
        <Field label="Taille">
          <Pills
            value={props.size ?? 'md'}
            onChange={(v) => onChange({ size: v as Props['size'] })}
            options={[
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
              { value: 'xl', label: 'XL' },
            ]}
          />
        </Field>
      </Group>
    </>
  ),
})
