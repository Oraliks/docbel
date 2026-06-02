'use client'

import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { mapEmbedSchema as schema } from './schemas'

export const mapEmbed = defineBlock({
  type: 'mapEmbed',
  schema,
  defaults: {
    query: 'Bruxelles, Belgique',
    zoom: 14,
    height: 400,
    caption: '',
  },
  meta: {
    name: 'Carte',
    description: 'Carte OpenStreetMap embeddée',
    category: 'media',
    icon: 'map-pin',
    shortcuts: ['map', 'carte'],
  },
  Render: ({ props }) => {
    const { query, height = 400, caption } = props
    const url = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent('4.30,50.83,4.42,50.88')}&marker=${encodeURIComponent('50.85,4.36')}&query=${encodeURIComponent(query)}`
    return (
      <figure className="my-2">
        <div className="rounded-2xl overflow-hidden border" style={{ height }}>
          <iframe
            src={url}
            title={query}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
        {caption ? (
          <figcaption className="mt-2 text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
            <MapPin className="size-3.5" />
            {caption}
          </figcaption>
        ) : (
          <figcaption className="mt-2 text-sm text-muted-foreground text-center">
            📍 {query}
          </figcaption>
        )}
      </figure>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Adresse / Recherche">
        <Input
          value={props.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Rue de la Loi 16, Bruxelles"
        />
      </Field>
      <Field label="Zoom">
        <SliderControl
          value={props.zoom ?? 14}
          onChange={(v) => onChange({ zoom: v })}
          min={1}
          max={19}
        />
      </Field>
      <Field label="Hauteur">
        <SliderControl
          value={props.height ?? 400}
          onChange={(v) => onChange({ height: v })}
          min={150}
          max={800}
          suffix="px"
        />
      </Field>
      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
