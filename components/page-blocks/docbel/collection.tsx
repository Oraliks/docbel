'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import {
  Field,
  Group,
  Pills,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { collectionSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

interface NewsItem {
  id: string
  title: string
  slug: string
  excerpt?: string
  image?: string
  category?: string
  publishedAt?: string
}

const COLS_CLASS: Record<NonNullable<Props['columns']>, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
}

export const collection = defineBlock({
  type: 'collection',
  schema,
  defaults: {
    source: 'news',
    limit: 3,
    layout: 'grid',
    columns: 3,
  },
  meta: {
    name: 'Collection',
    description: 'Liste dynamique (news, pages…)',
    category: 'docbel',
    icon: 'grid-2x2',
    shortcuts: ['collection', 'liste', 'news'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { source, limit, category, layout, columns = 3 } = props
    const [items, setItems] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      const ctrl = new AbortController()
      setLoading(true)
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('status', 'published')
      if (category) params.set('category', category)
      fetch(`/api/${source}?${params.toString()}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => {
          const rows = Array.isArray(data) ? data : data.items || []
          setItems(rows.slice(0, limit))
        })
        .catch((e) => {
          if (e?.name !== 'AbortError') setItems([])
        })
        .finally(() => setLoading(false))
      return () => ctrl.abort()
    }, [source, limit, category])

    if (loading) {
      return (
        <div className="w-full py-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )
    }
    if (items.length === 0) {
      return (
        <div className="w-full py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          {t('collection.empty')}
        </div>
      )
    }
    if (layout === 'list') {
      return (
        <div className="w-full py-8">
          <div className="space-y-3 mx-auto max-w-3xl px-4">
            {items.map((item) => (
              <a
                key={item.id}
                href={source === 'news' ? `/actualites/${item.slug}` : `/${item.slug}`}
                className="block rounded-xl border bg-card p-4 hover:border-primary hover:shadow-sm transition"
              >
                <div className="font-semibold">{item.title}</div>
                {item.excerpt && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.excerpt}</p>
                )}
              </a>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="w-full py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className={cn('grid grid-cols-1 gap-6', COLS_CLASS[columns])}>
            {items.map((item) => (
              <a
                key={item.id}
                href={source === 'news' ? `/actualites/${item.slug}` : `/${item.slug}`}
                className="group/coll rounded-2xl border bg-card overflow-hidden hover:shadow-md transition"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-video object-cover group-hover/coll:scale-105 transition-transform"
                  />
                )}
                <div className="p-5">
                  {item.category && (
                    <div className="text-xs font-medium uppercase tracking-wider text-primary">
                      {item.category}
                    </div>
                  )}
                  <h3 className="mt-1 font-semibold leading-tight">{item.title}</h3>
                  {item.excerpt && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{item.excerpt}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Source">
        <Pills
          value={props.source}
          onChange={(v) => onChange({ source: v as Props['source'] })}
          options={[
            { value: 'news', label: 'Actualités' },
            { value: 'pages', label: 'Pages' },
          ]}
        />
      </Field>
      <Field label="Catégorie (optionnel)">
        <Input
          value={props.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="Toutes catégories"
        />
      </Field>
      <Field label="Limite">
        <SliderControl
          value={props.limit}
          onChange={(v) => onChange({ limit: v })}
          min={1}
          max={20}
        />
      </Field>
      <Field label="Disposition">
        <Pills
          value={props.layout}
          onChange={(v) => onChange({ layout: v as Props['layout'] })}
          options={[
            { value: 'grid', label: 'Grille' },
            { value: 'list', label: 'Liste' },
            { value: 'carousel', label: 'Carrousel' },
          ]}
        />
      </Field>
      {props.layout === 'grid' && (
        <Field label="Colonnes">
          <Pills
            value={props.columns ?? 3}
            onChange={(v) => onChange({ columns: v as Props['columns'] })}
            options={[
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
          />
        </Field>
      )}
    </Group>
  ),
})
