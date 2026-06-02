'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RichTextInput } from '@/components/page-builder/inspector/rich-text-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { enrichHtmlWithAcronyms } from '@/lib/acronyms-html'
import { sanitizeHtml } from '@/lib/sanitize-html'
import { cn } from '@/lib/utils'
import { cardSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const VARIANT_CLASS: Record<NonNullable<Props['variant']>, string> = {
  default: 'border bg-card',
  bordered: 'border-2 bg-card',
  elevated: 'border-0 bg-card shadow-lg',
  gradient: 'border-0 bg-gradient-to-br from-primary/10 via-background to-background',
}

export const card = defineBlock({
  type: 'card',
  schema,
  defaults: {
    title: 'Titre de la carte',
    description: 'Description courte de la carte.',
    body: '',
    image: '',
    ctaText: '',
    ctaLink: '',
    variant: 'default',
  },
  meta: {
    name: 'Carte',
    description: 'Carte avec titre, description et CTA',
    category: 'ui',
    icon: 'square',
    shortcuts: ['card', 'carte'],
    variants: [
      { id: 'default', name: 'Standard' },
      { id: 'bordered', name: 'Bordée' },
      { id: 'elevated', name: 'Avec ombre' },
      { id: 'gradient', name: 'Dégradé' },
    ],
  },
  Render: ({ props }) => {
    const { title, description, body, image, ctaText, ctaLink, variant = 'default' } = props
    return (
      <div
        className={cn(
          'rounded-2xl overflow-hidden transition hover:-translate-y-0.5',
          VARIANT_CLASS[variant]
        )}
      >
        {image && <img src={image} alt="" className="w-full aspect-video object-cover" />}
        <div className="p-6">
          {title && <h3 className="text-lg font-semibold tracking-tight">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
          {body && (
            <div
              className="mt-3 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: enrichHtmlWithAcronyms(sanitizeHtml(body)) }}
            />
          )}
          {ctaText && (
            <a
              href={safeHref(ctaLink)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {ctaText}
              <ArrowRight className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input value={props.title ?? ''} onChange={(e) => onChange({ title: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Image">
        <ImageUpload value={props.image ?? ''} onChange={(url) => onChange({ image: url })} />
      </Field>
      <Field label="Corps (rich-text)">
        <RichTextInput
          value={props.body ?? ''}
          onChange={(html) => onChange({ body: html })}
          placeholder="(optionnel)"
        />
      </Field>
      <Field label="Texte du bouton">
        <Input
          value={props.ctaText ?? ''}
          onChange={(e) => onChange({ ctaText: e.target.value })}
          placeholder="(optionnel)"
        />
      </Field>
      <Field label="Lien">
        <Input
          value={props.ctaLink ?? ''}
          onChange={(e) => onChange({ ctaLink: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
