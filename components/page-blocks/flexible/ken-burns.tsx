'use client'

/* eslint-disable @next/next/no-img-element */

import { Input } from '@/components/ui/input'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { kenBurnsSchema as schema } from './schemas'

export const kenBurns = defineBlock({
  type: 'kenBurns',
  schema,
  defaults: { image: '', caption: '', duration: 20 },
  meta: {
    name: 'Image Ken Burns',
    description: 'Image avec zoom lent',
    category: 'decorative',
    icon: 'image',
    shortcuts: ['kenburns', 'zoom'],
  },
  Render: ({ props }) => {
    const { image, caption, duration = 20 } = props
    if (!image) {
      return (
        <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-sm text-muted-foreground my-2">
          Configurez une image
        </div>
      )
    }
    return (
      <figure className="my-2 overflow-hidden rounded-2xl">
        <div className="aspect-video overflow-hidden">
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            style={{ animation: `kenburns ${duration}s ease-in-out infinite alternate` }}
          />
        </div>
        {caption && (
          <figcaption className="mt-2 text-sm text-muted-foreground text-center">
            {caption}
          </figcaption>
        )}
        <style jsx>{`
          @keyframes kenburns {
            from {
              transform: scale(1) translate(0, 0);
            }
            to {
              transform: scale(1.15) translate(-2%, -2%);
            }
          }
        `}</style>
      </figure>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Image">
        <ImageUpload value={props.image} onChange={(url) => onChange({ image: url })} />
      </Field>
      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
      <Field label="Durée du cycle">
        <SliderControl
          value={props.duration ?? 20}
          onChange={(v) => onChange({ duration: v })}
          min={5}
          max={60}
          suffix="s"
        />
      </Field>
    </Group>
  ),
})
