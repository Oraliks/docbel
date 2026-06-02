'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { z } from 'zod'
import { X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { RepeaterList } from '@/components/page-builder/inspector/repeater-list'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { imageHotspotsHotspotSchema, imageHotspotsSchema as schema } from './schemas'

type Hotspot = z.infer<typeof imageHotspotsHotspotSchema>

export const imageHotspots = defineBlock({
  type: 'imageHotspots',
  schema,
  defaults: {
    image: '',
    alt: '',
    hotspots: [
      { x: 25, y: 30, title: 'Point 1', description: 'Description du point 1.' },
      { x: 60, y: 70, title: 'Point 2', description: 'Description du point 2.' },
    ],
  },
  meta: {
    name: 'Image avec points',
    description: 'Image cliquable avec hotspots',
    category: 'media',
    icon: 'image',
    shortcuts: ['hotspots'],
  },
  Render: ({ props }) => {
    const { image, alt, hotspots } = props
    const [active, setActive] = useState<number | null>(null)
    if (!image) {
      return (
        <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-sm text-muted-foreground my-2">
          Configurez une image pour les points d&apos;intérêt
        </div>
      )
    }
    return (
      <figure className="relative my-2 rounded-2xl overflow-hidden">
        <img src={image} alt={alt || ''} loading="lazy" decoding="async" className="w-full block" />
        {hotspots.map((h, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(active === i ? null : i)}
            className={cn(
              'absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg transition-all hover:scale-110',
              active === i && 'scale-125 ring-4 ring-primary/30'
            )}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
          >
            {i + 1}
            <span className="absolute inline-flex size-full rounded-full bg-primary/40 animate-ping" />
          </button>
        ))}
        {active !== null && (
          <div
            className="absolute z-10 -translate-x-1/2 mt-3 max-w-xs rounded-xl bg-card shadow-2xl border p-3 text-sm"
            style={{ left: `${hotspots[active].x}%`, top: `${hotspots[active].y}%` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold">{hotspots[active].title}</div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="opacity-60 hover:opacity-100"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{hotspots[active].description}</p>
          </div>
        )}
      </figure>
    )
  },
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Image" defaultOpen>
        <Field label="Image">
          <ImageUpload value={props.image} onChange={(url) => onChange({ image: url })} />
        </Field>
        <Field label="Alt">
          <Input
            value={props.alt ?? ''}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
        </Field>
      </Group>
      <Group title={`Points (${props.hotspots.length})`} defaultOpen>
        <RepeaterList<Hotspot>
          items={props.hotspots}
          onChange={(hotspots) => onChange({ hotspots })}
          render={(it, set) => (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="X (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={it.x}
                    onChange={(e) => set({ x: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Y (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={it.y}
                    onChange={(e) => set({ y: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
              <Input
                value={it.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Titre"
                className="h-8 text-xs"
              />
              <Textarea
                value={it.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Description"
                rows={2}
                className="text-xs resize-y"
              />
            </>
          )}
          addItem={() => ({ x: 50, y: 50, title: 'Nouveau point', description: '' })}
        />
      </Group>
    </>
  ),
})
