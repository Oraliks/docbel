'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { pressMentionsSchema as schema, pressMentionsLogoSchema } from './schemas'

type Logo = z.infer<typeof pressMentionsLogoSchema>

export const pressMentions = defineBlock({
  type: 'pressMentions',
  schema,
  defaults: {
    title: 'Vu dans',
    logos: [
      { url: '', alt: 'Le Soir' },
      { url: '', alt: 'RTBF' },
      { url: '', alt: 'L\'Avenir' },
    ],
  },
  meta: {
    name: 'Mentions presse',
    description: 'Logos de médias',
    category: 'marketing',
    icon: 'image',
    shortcuts: ['press', 'media', 'asseen'],
  },
  Render: ({ props }) => (
    <div className="w-full py-6">
      <div className="mx-auto max-w-7xl px-6">
        {props.title && (
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {props.title}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {props.logos.map((logo, i) =>
            logo.url ? (
              <img key={i} src={logo.url} alt={logo.alt} loading="lazy" decoding="async" className="h-7 object-contain" />
            ) : (
              <span key={i} className="text-base font-serif italic">
                {logo.alt}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  ),
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Logos (${props.logos.length})`} defaultOpen>
        <RepeaterList<Logo>
          items={props.logos}
          onChange={(logos) => onChange({ logos })}
          render={(it, set) => (
            <>
              <ImageUpload value={it.url} onChange={(url) => set({ url })} compact />
              <Input
                value={it.alt}
                onChange={(e) => set({ alt: e.target.value })}
                placeholder="Nom du média"
                className="h-8 text-xs"
              />
              <Input
                value={it.href ?? ''}
                onChange={(e) => set({ href: e.target.value })}
                placeholder="Lien (optionnel)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ url: '', alt: 'Média', href: '' })}
        />
      </Group>
    </>
  ),
})
