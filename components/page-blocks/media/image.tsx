'use client'

/* eslint-disable @next/next/no-img-element */

import { z } from 'zod'
import { ImageOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { imageSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

const RATIO_CLASS: Record<NonNullable<Props['ratio']>, string> = {
  auto: '',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
}

const ROUNDED_CLASS: Record<NonNullable<Props['rounded']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-lg',
  lg: 'rounded-2xl',
  full: 'rounded-full',
}

export const image = defineBlock({
  type: 'image',
  schema,
  defaults: { url: '', alt: '', caption: '', ratio: 'auto', fit: 'cover', rounded: 'md' },
  meta: {
    name: 'Image',
    description: 'Photo ou illustration',
    category: 'media',
    icon: 'image',
    shortcuts: ['img', 'image', 'photo'],
  },
  Render: ({ props }) => {
    const { url, alt, caption, ratio = 'auto', fit = 'cover', rounded = 'md' } = props
    return (
      <figure className="w-full">
        {url ? (
          <div className={cn('overflow-hidden bg-muted', RATIO_CLASS[ratio], ROUNDED_CLASS[rounded])}>
            <img
              src={url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className={cn('w-full h-full', fit === 'cover' ? 'object-cover' : 'object-contain')}
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center bg-muted text-muted-foreground border border-dashed',
              RATIO_CLASS[ratio] || 'aspect-video',
              ROUNDED_CLASS[rounded]
            )}
          >
            <ImageOff className="size-8" />
          </div>
        )}
        {caption && (
          <figcaption className="mt-2 text-sm text-muted-foreground text-center">
            {caption}
          </figcaption>
        )}
      </figure>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Image">
        <ImageUpload value={props.url} onChange={(url) => onChange({ url })} />
      </Field>
      <Field label="Texte alternatif">
        <Input
          value={props.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Description de l'image"
        />
      </Field>
      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
      <Field label="Ratio">
        <Select
          value={props.ratio ?? 'auto'}
          onValueChange={(v) => onChange({ ratio: v as Props['ratio'] })}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="1:1">Carré (1:1)</SelectItem>
            <SelectItem value="4:3">Standard (4:3)</SelectItem>
            <SelectItem value="16:9">Cinéma (16:9)</SelectItem>
            <SelectItem value="21:9">Ultra-wide (21:9)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Ajustement">
        <Pills
          value={props.fit ?? 'cover'}
          onChange={(v) => onChange({ fit: v as Props['fit'] })}
          options={[
            { value: 'cover', label: 'Cover' },
            { value: 'contain', label: 'Contain' },
          ]}
        />
      </Field>
      <Field label="Coins arrondis">
        <Pills
          value={props.rounded ?? 'md'}
          onChange={(v) => onChange({ rounded: v as Props['rounded'] })}
          options={[
            { value: 'none', label: 'Aucun' },
            { value: 'sm', label: 'Sm' },
            { value: 'md', label: 'Md' },
            { value: 'lg', label: 'Lg' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Field>
    </Group>
  ),
})
