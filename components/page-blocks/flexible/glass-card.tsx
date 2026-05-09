'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  blur: z.number().min(0).max(50).optional(),
  bgImage: z.string().max(4096).optional(),
})

export const glassCard = defineBlock({
  type: 'glassCard',
  schema,
  defaults: {
    title: 'Effet verre',
    description: 'Glassmorphism avec un fond flou.',
    blur: 12,
    bgImage: '',
  },
  meta: {
    name: 'Carte verre',
    description: 'Glassmorphism avec effet flou',
    category: 'decorative',
    icon: 'square',
    shortcuts: ['glass', 'verre'],
  },
  Render: ({ props }) => {
    const { title, description, blur = 12, bgImage } = props
    return (
      <div
        className="relative rounded-2xl overflow-hidden my-2 p-6 min-h-[200px]"
        style={{
          backgroundImage: bgImage
            ? `url(${bgImage})`
            : 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-4 rounded-xl bg-white/20 dark:bg-black/30 border border-white/30 p-5 text-white"
          style={{ backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` }}
        >
          {title && <h3 className="text-xl font-bold drop-shadow-md">{title}</h3>}
          {description && <p className="mt-2 text-sm opacity-90 drop-shadow">{description}</p>}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Image de fond">
        <ImageUpload
          value={props.bgImage ?? ''}
          onChange={(url) => onChange({ bgImage: url })}
        />
      </Field>
      <Field label="Flou (px)">
        <SliderControl
          value={props.blur ?? 12}
          onChange={(v) => onChange({ blur: v })}
          min={0}
          max={30}
          suffix="px"
        />
      </Field>
    </Group>
  ),
})
