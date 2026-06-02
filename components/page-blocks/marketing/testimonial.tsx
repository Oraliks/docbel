'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { Quote as QuoteIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { testimonialSchema as schema } from './schemas'

type Props = z.infer<typeof schema>
type Item = Props['items'][number]

function Card({ quote, author, role, avatar }: Item) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <QuoteIcon className="size-5 text-primary opacity-60 mb-3" />
      <p className="text-sm leading-relaxed">“{quote}”</p>
      <div className="mt-4 flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" loading="lazy" decoding="async" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="size-10 rounded-full bg-muted" />
        )}
        <div>
          <div className="font-semibold text-sm">{author}</div>
          {role && <div className="text-xs text-muted-foreground">{role}</div>}
        </div>
      </div>
    </div>
  )
}

export const testimonial = defineBlock({
  type: 'testimonial',
  schema,
  defaults: {
    title: 'Ils nous font confiance',
    items: [
      {
        quote: 'Un service exceptionnel, je recommande !',
        author: 'Marie Dupont',
        role: 'CEO, Acme Inc.',
      },
    ],
    variant: 'single',
  },
  meta: {
    name: 'Témoignage',
    description: 'Avis client',
    category: 'marketing',
    icon: 'message-square-quote',
    shortcuts: ['testimonial', 'temoignage', 'avis'],
    variants: [
      { id: 'single', name: 'Simple' },
      { id: 'grid', name: 'Grille' },
      { id: 'carousel', name: 'Carousel' },
    ],
  },
  Render: ({ props }) => {
    const { title, items, variant = 'single' } = props
    if (!items || items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Aucun témoignage
        </div>
      )
    }
    if (variant === 'grid') {
      return (
        <div className="w-full py-12">
          <div className="mx-auto max-w-7xl px-6">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
                {title}
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((t, idx) => (
                <Card key={idx} {...t} />
              ))}
            </div>
          </div>
        </div>
      )
    }
    const t = items[0]
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <QuoteIcon className="size-8 mx-auto text-primary opacity-60 mb-4" />
          <blockquote className="text-2xl md:text-3xl font-medium leading-snug">
            “{t.quote}”
          </blockquote>
          <div className="mt-6 flex items-center justify-center gap-3">
            {t.avatar && <img src={t.avatar} alt="" loading="lazy" decoding="async" className="size-12 rounded-full object-cover" />}
            <div className="text-left">
              <div className="font-semibold">{t.author}</div>
              {t.role && <div className="text-sm text-muted-foreground">{t.role}</div>}
            </div>
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="En-tête" defaultOpen>
        <Field label="Titre de section">
          <Input
            value={props.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Témoignages (${props.items.length})`} defaultOpen>
        <RepeaterList<Item>
          items={props.items}
          onChange={(items) => onChange({ items })}
          render={(item, set) => (
            <>
              <Textarea
                value={item.quote}
                onChange={(e) => set({ quote: e.target.value })}
                placeholder="Citation"
                rows={2}
                className="resize-y text-xs"
              />
              <Input
                value={item.author}
                onChange={(e) => set({ author: e.target.value })}
                placeholder="Auteur"
                className="h-8 text-xs"
              />
              <Input
                value={item.role ?? ''}
                onChange={(e) => set({ role: e.target.value })}
                placeholder="Rôle"
                className="h-8 text-xs"
              />
              <ImageUpload
                value={item.avatar ?? ''}
                onChange={(url) => set({ avatar: url })}
                compact
              />
            </>
          )}
          addItem={() => ({ quote: 'Nouveau témoignage', author: 'Auteur', role: '' })}
        />
      </Group>
    </>
  ),
})
