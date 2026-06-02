'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  ColorControl,
  Field,
  Group,
} from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { LinkInput } from '@/components/page-builder/inspector/link-input'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { heroSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

function HeroCtas({
  ctaText,
  ctaLink,
  secondText,
  secondLink,
  align = 'left',
}: {
  ctaText?: string
  ctaLink?: string
  secondText?: string
  secondLink?: string
  align?: 'left' | 'center'
}) {
  if (!ctaText && !secondText) return null
  return (
    <div
      className={cn(
        'mt-8 flex flex-wrap items-center gap-3',
        align === 'center' && 'justify-center'
      )}
    >
      {ctaText && (
        <a
          href={safeHref(ctaLink)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-3 text-sm font-medium hover:opacity-90 transition"
        >
          {ctaText}
          <ArrowRight className="size-4" />
        </a>
      )}
      {secondText && (
        <a
          href={safeHref(secondLink)}
          className="inline-flex items-center gap-2 rounded-lg border border-current/20 px-5 py-3 text-sm font-medium hover:bg-current/5 transition"
        >
          {secondText}
        </a>
      )}
    </div>
  )
}

export const hero = defineBlock({
  type: 'hero',
  schema,
  defaults: {
    title: 'Un titre accrocheur',
    subtitle: 'Sous-titre court',
    description:
      'Description plus longue qui explique en quelques mots ce que vous proposez.',
    ctaText: 'Commencer',
    ctaLink: '#',
    ctaSecondaryText: '',
    ctaSecondaryLink: '',
    image: '',
    bgColor: '#111318',
    variant: 'centered',
  },
  meta: {
    name: 'Hero',
    description: 'Bannière d’accueil',
    category: 'marketing',
    icon: 'sparkles',
    shortcuts: ['hero', 'banner'],
    variants: [
      { id: 'centered', name: 'Centré' },
      { id: 'split', name: 'Split (image à droite)' },
      { id: 'minimal', name: 'Minimal' },
      { id: 'fullbleed', name: 'Pleine page' },
    ],
  },
  Render: ({ props }) => {
    const {
      title,
      subtitle,
      description,
      ctaText,
      ctaLink,
      ctaSecondaryText,
      ctaSecondaryLink,
      image,
      bgColor,
      variant = 'centered',
    } = props
    const isDark = bgColor && /^#(0|1|2|3|4)/.test(bgColor)

    if (variant === 'split') {
      return (
        <div
          className="relative w-full overflow-hidden"
          style={{
            backgroundColor: bgColor || '#111318',
            color: isDark ? '#fff' : undefined,
          }}
        >
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              {subtitle && (
                <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-70">
                  {subtitle}
                </p>
              )}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
                {title}
              </h1>
              {description && <p className="mt-6 text-lg opacity-80 max-w-xl">{description}</p>}
              <HeroCtas
                ctaText={ctaText}
                ctaLink={ctaLink}
                secondText={ctaSecondaryText}
                secondLink={ctaSecondaryLink}
              />
            </div>
            {image ? (
              <img
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full rounded-2xl object-cover aspect-[4/3] md:aspect-square"
              />
            ) : (
              <div className="aspect-[4/3] md:aspect-square rounded-2xl bg-white/10 border border-white/10" />
            )}
          </div>
        </div>
      )
    }

    if (variant === 'minimal') {
      return (
        <div className="w-full py-12 md:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-base md:text-lg text-muted-foreground">{description}</p>
            )}
            <HeroCtas
              ctaText={ctaText}
              ctaLink={ctaLink}
              secondText={ctaSecondaryText}
              secondLink={ctaSecondaryLink}
            />
          </div>
        </div>
      )
    }

    if (variant === 'fullbleed') {
      return (
        <div
          className="relative w-full min-h-[60vh] md:min-h-[70vh] flex items-center"
          style={{
            backgroundColor: bgColor || '#111318',
            backgroundImage: image ? `url(${image})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#fff',
          }}
        >
          {image && <div className="absolute inset-0 bg-black/40" aria-hidden />}
          <div className="relative mx-auto max-w-7xl px-6 py-20 w-full">
            <div className="max-w-3xl">
              {subtitle && (
                <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-80">
                  {subtitle}
                </p>
              )}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
                {title}
              </h1>
              {description && <p className="mt-6 text-lg md:text-xl opacity-90">{description}</p>}
              <HeroCtas
                ctaText={ctaText}
                ctaLink={ctaLink}
                secondText={ctaSecondaryText}
                secondLink={ctaSecondaryLink}
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        className="relative w-full"
        style={{
          backgroundColor: bgColor || 'transparent',
          color: isDark ? '#fff' : undefined,
        }}
      >
        <div className="mx-auto max-w-4xl px-6 py-16 md:py-24 text-center">
          {subtitle && (
            <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-70">
              {subtitle}
            </p>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            {title}
          </h1>
          {description && (
            <p className="mt-6 text-lg md:text-xl opacity-80 max-w-2xl mx-auto">{description}</p>
          )}
          <HeroCtas
            ctaText={ctaText}
            ctaLink={ctaLink}
            secondText={ctaSecondaryText}
            secondLink={ctaSecondaryLink}
            align="center"
          />
          {image && <img src={image} alt="" loading="lazy" decoding="async" className="mt-12 w-full rounded-2xl shadow-2xl" />}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Contenu" defaultOpen>
        <Field label="Sur-titre">
          <Input
            value={props.subtitle ?? ''}
            onChange={(e) => onChange({ subtitle: e.target.value })}
            placeholder="Ex: NOUVEAU"
          />
        </Field>
        <Field label="Titre principal">
          <Textarea
            value={props.title}
            onChange={(e) => onChange({ title: e.target.value })}
            rows={2}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={props.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={3}
          />
        </Field>
      </Group>
      <Group title="Boutons">
        <Field label="Bouton principal — texte">
          <Input
            value={props.ctaText ?? ''}
            onChange={(e) => onChange({ ctaText: e.target.value })}
          />
        </Field>
        <Field label="Bouton principal — lien">
          <LinkInput
            value={props.ctaLink ?? ''}
            onChange={(ctaLink) => onChange({ ctaLink })}
            placeholder="/page-cible ou https://…"
          />
        </Field>
        <Field label="Bouton secondaire — texte">
          <Input
            value={props.ctaSecondaryText ?? ''}
            onChange={(e) => onChange({ ctaSecondaryText: e.target.value })}
          />
        </Field>
        <Field label="Bouton secondaire — lien">
          <LinkInput
            value={props.ctaSecondaryLink ?? ''}
            onChange={(ctaSecondaryLink) => onChange({ ctaSecondaryLink })}
          />
        </Field>
      </Group>
      <Group title="Apparence">
        <Field label="Couleur de fond">
          <ColorControl value={props.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
        <Field label="Image de fond / illustration">
          <ImageUpload value={props.image ?? ''} onChange={(url) => onChange({ image: url })} />
        </Field>
      </Group>
    </>
  ),
})
