'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { logoWallSchema as schema } from './schemas'

type Props = z.infer<typeof schema>
type Logo = Props['logos'][number]

export const logoWall = defineBlock({
  type: 'logoWall',
  schema,
  defaults: {
    title: 'Ils nous font confiance',
    logos: [
      { url: '', alt: 'Logo 1' },
      { url: '', alt: 'Logo 2' },
      { url: '', alt: 'Logo 3' },
      { url: '', alt: 'Logo 4' },
    ],
    variant: 'grid',
    grayscale: true,
  },
  meta: {
    name: 'Mur de logos',
    description: 'Bande de logos clients/partenaires',
    category: 'media',
    icon: 'grid-2x2',
    shortcuts: ['logos', 'logowall'],
  },
  Render: ({ props }) => {
    const { title, logos, variant = 'grid', grayscale = true } = props
    return (
      <div className="w-full py-8">
        <div className="mx-auto max-w-7xl px-6">
          {title && (
            <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
          )}
          {variant === 'marquee' ? (
            <div className="overflow-hidden">
              <div
                className={cn(
                  'flex items-center gap-12 animate-[marquee_30s_linear_infinite]',
                  grayscale &&
                    'opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition'
                )}
                style={{ animation: 'marquee 30s linear infinite' }}
              >
                {[...logos, ...logos].map((logo, i) =>
                  logo.url ? (
                    <img
                      key={i}
                      src={logo.url}
                      alt={logo.alt}
                      loading="lazy"
                      decoding="async"
                      className="h-10 object-contain shrink-0"
                    />
                  ) : null
                )}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center',
                grayscale &&
                  '[&>*]:opacity-70 [&>*]:grayscale [&>*:hover]:grayscale-0 [&>*:hover]:opacity-100'
              )}
            >
              {logos.map((logo, i) =>
                logo.url ? (
                  <a
                    key={i}
                    href={safeHref(logo.href)}
                    className="flex items-center justify-center transition"
                  >
                    <img src={logo.url} alt={logo.alt} loading="lazy" decoding="async" className="h-10 object-contain" />
                  </a>
                ) : (
                  <div
                    key={i}
                    className="h-10 rounded bg-muted/40 flex items-center justify-center text-xs text-muted-foreground"
                  >
                    {logo.alt}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Affichage" defaultOpen>
        <Field label="Titre">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Disposition">
          <Pills
            value={props.variant ?? 'grid'}
            onChange={(v) => onChange({ variant: v as Props['variant'] })}
            options={[
              { value: 'grid', label: 'Grille' },
              { value: 'marquee', label: 'Défilant' },
            ]}
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Nuances de gris" className="flex-1">
            <span className="sr-only">grayscale</span>
          </Field>
          <Switch
            checked={props.grayscale ?? true}
            onCheckedChange={(v) => onChange({ grayscale: v })}
          />
        </div>
      </Group>
      <Group title={`Logos (${props.logos.length})`} defaultOpen>
        <RepeaterList<Logo>
          items={props.logos}
          onChange={(logos) => onChange({ logos })}
          render={(item, set) => (
            <>
              <ImageUpload value={item.url} onChange={(url) => set({ url })} compact />
              <Input
                value={item.alt}
                onChange={(e) => set({ alt: e.target.value })}
                placeholder="Nom"
                className="h-8 text-xs"
              />
              <Input
                value={item.href ?? ''}
                onChange={(e) => set({ href: e.target.value })}
                placeholder="Lien (optionnel)"
                className="h-8 text-xs"
              />
            </>
          )}
          addItem={() => ({ url: '', alt: 'Logo', href: '' })}
        />
      </Group>
    </>
  ),
})
