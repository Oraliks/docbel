'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { exitIntentSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
}

function ExitIntentView({
  title,
  description,
  ctaText,
  ctaLink,
  size = 'md',
  oncePerSession = true,
}: Props) {
  const [open, setOpen] = useState(false)
  // Computed once; on the public SSR'd page this is false (no /admin), so the
  // dialog is armed; in the editor (client-only /admin route) it shows a chip.
  const [isEditor] = useState(
    () => typeof window !== 'undefined' && window.location.pathname.includes('/admin')
  )

  useEffect(() => {
    if (isEditor) return
    const key = 'beldoc:exit-intent-shown'
    if (oncePerSession && sessionStorage.getItem(key)) return
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) {
        setOpen(true)
        if (oncePerSession) sessionStorage.setItem(key, '1')
        document.removeEventListener('mouseout', onMouseOut)
      }
    }
    document.addEventListener('mouseout', onMouseOut)
    return () => document.removeEventListener('mouseout', onMouseOut)
  }, [isEditor, oncePerSession])

  if (isEditor) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
        🪧 Pop-up de sortie — invisible sur le site, s’affiche quand le visiteur
        s’apprête à quitter la page.
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={SIZE_CLASS[size]}>
        <DialogHeader>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>
        {ctaText && (
          <a
            href={safeHref(ctaLink)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {ctaText}
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}

export const exitIntent = defineBlock({
  type: 'exitIntent',
  schema,
  defaults: {
    title: 'Attendez ! 👋',
    description: 'Avant de partir, profitez de notre offre.',
    ctaText: 'En profiter',
    ctaLink: '#',
    size: 'md',
    oncePerSession: true,
  },
  meta: {
    name: 'Pop-up de sortie',
    description: 'Modale affichée à l’intention de sortie',
    category: 'marketing',
    icon: 'log-out',
    shortcuts: ['exit', 'exit-intent', 'popup', 'sortie'],
  },
  Render: ({ props }) => <ExitIntentView {...props} />,
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Bouton — texte">
        <Input
          value={props.ctaText ?? ''}
          onChange={(e) => onChange({ ctaText: e.target.value })}
        />
      </Field>
      <Field label="Bouton — lien">
        <LinkInput
          value={props.ctaLink ?? ''}
          onChange={(ctaLink) => onChange({ ctaLink })}
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
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Une fois par session" className="flex-1">
          <span className="sr-only">Une fois par session</span>
        </Field>
        <Switch
          checked={props.oncePerSession ?? true}
          onCheckedChange={(v) => onChange({ oncePerSession: v })}
        />
      </div>
    </Group>
  ),
})
