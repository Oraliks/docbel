'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { RichTextInput } from '@/components/page-builder/inspector/rich-text-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { drawerSchema as schema } from './schemas'

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

function DrawerView({
  triggerText = 'Ouvrir',
  triggerVariant = 'primary',
  triggerSize = 'md',
  hideTrigger,
  drawerId,
  side = 'right',
  title,
  description,
  content,
}: Props) {
  const [open, setOpen] = useState(false)

  // Shares the "open by id" event with modals — an "Ouvrir une modale" action
  // targeting this drawer's id opens it.
  useEffect(() => {
    if (!drawerId) return
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id
      if (id === drawerId) setOpen(true)
    }
    window.addEventListener('beldoc:open-modal', handler as EventListener)
    return () => window.removeEventListener('beldoc:open-modal', handler as EventListener)
  }, [drawerId])

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
          {triggerText}
        </button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="overflow-y-auto">
          {(title || description) && (
            <SheetHeader>
              {title && <SheetTitle>{title}</SheetTitle>}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </SheetHeader>
          )}
          {content && (
            <div
              className="prose prose-sm prose-neutral max-w-none px-4 pb-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

export const drawer = defineBlock({
  type: 'drawer',
  schema,
  defaults: {
    triggerText: 'Ouvrir le panneau',
    triggerVariant: 'outline',
    triggerSize: 'md',
    side: 'right',
    title: 'Panneau',
    description: '',
    content: '<p>Contenu du panneau latéral.</p>',
  },
  meta: {
    name: 'Panneau (drawer)',
    description: 'Bouton qui ouvre un panneau latéral',
    category: 'ui',
    icon: 'panel-right',
    shortcuts: ['drawer', 'panneau', 'sheet'],
  },
  Render: ({ props }) => <DrawerView {...props} />,
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
        <Field label="ID (pour l'action « Ouvrir une modale »)">
          <Input
            value={props.drawerId ?? ''}
            onChange={(e) => onChange({ drawerId: e.target.value })}
            placeholder="ex: menu"
            className="font-mono text-xs"
          />
        </Field>
      </Group>
      <Group title="Contenu" defaultOpen>
        <Field label="Côté">
          <Pills
            value={props.side ?? 'right'}
            onChange={(v) => onChange({ side: v as Props['side'] })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'right', label: 'Droite' },
              { value: 'top', label: 'Haut' },
              { value: 'bottom', label: 'Bas' },
            ]}
          />
        </Field>
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
      </Group>
    </>
  ),
})
