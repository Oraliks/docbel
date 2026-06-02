'use client'

/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type MouseEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { tiltCardSchema as schema } from './schemas'

export const tiltCard = defineBlock({
  type: 'tiltCard',
  schema,
  defaults: {
    title: 'Carte interactive',
    description: 'Survolez-moi pour voir l\'effet.',
    image: '',
    link: '',
  },
  meta: {
    name: 'Carte 3D',
    description: 'Carte avec effet 3D au hover',
    category: 'ui',
    icon: 'square',
    shortcuts: ['tilt'],
  },
  Render: ({ props }) => {
    const { title, description, image, link } = props
    const [tilt, setTilt] = useState({ x: 0, y: 0 })
    const ref = useRef<HTMLDivElement>(null)

    const onMove = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      setTilt({ x: (py - 0.5) * -10, y: (px - 0.5) * 10 })
    }

    const Inner = (
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        className="rounded-2xl border bg-card p-6 transition-transform duration-200 ease-out shadow-lg hover:shadow-2xl"
        style={{
          transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="w-full aspect-video object-cover rounded-lg mb-4"
            style={{ transform: 'translateZ(20px)' }}
          />
        )}
        <h3 className="font-semibold text-lg" style={{ transform: 'translateZ(40px)' }}>
          {title}
        </h3>
        {description && (
          <p
            className="mt-2 text-sm text-muted-foreground"
            style={{ transform: 'translateZ(20px)' }}
          >
            {description}
          </p>
        )}
      </div>
    )

    if (link) {
      return (
        <a href={safeHref(link)} className="block my-2">
          {Inner}
        </a>
      )
    }
    return <div className="my-2">{Inner}</div>
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input value={props.title} onChange={(e) => onChange({ title: e.target.value })} />
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
        <ImageUpload
          value={props.image ?? ''}
          onChange={(url) => onChange({ image: url })}
        />
      </Field>
      <Field label="Lien">
        <Input
          value={props.link ?? ''}
          onChange={(e) => onChange({ link: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
