'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'

const itemSchema = z.object({
  url: z.string().max(4096),
  alt: z.string().max(500),
  caption: z.string().max(500).optional(),
})

const schema = z.object({
  items: z.array(itemSchema).max(50),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  variant: z.enum(['grid', 'masonry']).optional(),
  gap: z.enum(['sm', 'md', 'lg']).optional(),
})

type Props = z.infer<typeof schema>

const GAP_CLASS: Record<NonNullable<Props['gap']>, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

const COL_CLASS: Record<Props['columns'], string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export const gallery = defineBlock({
  type: 'gallery',
  schema,
  defaults: {
    items: [
      { url: '', alt: 'Image 1' },
      { url: '', alt: 'Image 2' },
      { url: '', alt: 'Image 3' },
    ],
    columns: 3,
    variant: 'grid',
    gap: 'md',
  },
  meta: {
    name: 'Galerie',
    description: 'Grille d’images',
    category: 'media',
    icon: 'images',
    shortcuts: ['gallery', 'galerie'],
  },
  Render: ({ props }) => {
    const { items, columns, variant = 'grid', gap = 'md' } = props
    if (!items || items.length === 0) {
      return (
        <div className="aspect-[3/1] flex items-center justify-center bg-muted text-muted-foreground rounded-lg border border-dashed">
          Galerie vide — ajoutez des images
        </div>
      )
    }
    if (variant === 'masonry') {
      return (
        <div className={cn('columns-2 md:columns-3', GAP_CLASS[gap])}>
          {items.map((item, idx) => (
            <figure key={idx} className="mb-4 break-inside-avoid">
              {item.url ? (
                <img src={item.url} alt={item.alt} className="w-full rounded-lg" />
              ) : (
                <div className="aspect-square rounded-lg bg-muted" />
              )}
              {item.caption && (
                <figcaption className="mt-1 text-xs text-muted-foreground">
                  {item.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )
    }
    return (
      <div className={cn('grid', COL_CLASS[columns], GAP_CLASS[gap])}>
        {items.map((item, idx) => (
          <figure key={idx}>
            <div className="aspect-square overflow-hidden rounded-lg bg-muted">
              {item.url ? (
                <img src={item.url} alt={item.alt} className="w-full h-full object-cover" />
              ) : null}
            </div>
            {item.caption && (
              <figcaption className="mt-1 text-xs text-muted-foreground">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    )
  },
  Fields: ({ props, onChange }) => {
    const updateItem = (idx: number, patch: Partial<Props['items'][number]>) => {
      onChange({ items: props.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) })
    }
    const addItem = () =>
      onChange({ items: [...props.items, { url: '', alt: `Image ${props.items.length + 1}` }] })
    const removeItem = (idx: number) =>
      onChange({ items: props.items.filter((_, i) => i !== idx) })

    return (
      <>
        <Group title="Mise en page" defaultOpen>
          <Field label="Colonnes">
            <Pills
              value={props.columns}
              onChange={(v) => onChange({ columns: v as Props['columns'] })}
              options={[
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
              ]}
            />
          </Field>
          <Field label="Espacement">
            <Pills
              value={props.gap ?? 'md'}
              onChange={(v) => onChange({ gap: v as Props['gap'] })}
              options={[
                { value: 'sm', label: 'Sm' },
                { value: 'md', label: 'Md' },
                { value: 'lg', label: 'Lg' },
              ]}
            />
          </Field>
        </Group>
        <Group title={`Images (${props.items.length})`} defaultOpen>
          <div className="space-y-2">
            {props.items.map((item, idx) => (
              <div key={idx} className="rounded-md border p-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <GripVertical className="size-3" />
                  Image {idx + 1}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="ml-auto h-6 w-6 text-destructive"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
                <ImageUpload
                  value={item.url}
                  onChange={(url) => updateItem(idx, { url })}
                  compact
                />
                <Input
                  value={item.alt}
                  onChange={(e) => updateItem(idx, { alt: e.target.value })}
                  placeholder="Texte alternatif"
                  className="h-8 text-xs"
                />
              </div>
            ))}
            <Button variant="outline" className="w-full h-8" onClick={addItem}>
              <Plus className="mr-1.5 size-3.5" />
              Ajouter une image
            </Button>
          </div>
        </Group>
      </>
    )
  },
})
