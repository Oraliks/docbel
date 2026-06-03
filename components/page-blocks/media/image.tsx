'use client'

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react'
import { z } from 'zod'
import { ImageOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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

function ImageFigure({
  url,
  alt,
  caption,
  ratio = 'auto',
  fit = 'cover',
  rounded = 'md',
  focalX,
  focalY,
  blurUp,
}: Props) {
  const [loaded, setLoaded] = useState(false)

  if (!url) {
    return (
      <figure className="w-full">
        <div
          className={cn(
            'flex items-center justify-center bg-muted text-muted-foreground border border-dashed',
            RATIO_CLASS[ratio] || 'aspect-video',
            ROUNDED_CLASS[rounded]
          )}
        >
          <ImageOff className="size-8" />
        </div>
      </figure>
    )
  }

  return (
    <figure className="w-full">
      <div className={cn('overflow-hidden bg-muted', RATIO_CLASS[ratio], ROUNDED_CLASS[rounded])}>
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={
            fit === 'cover' && (focalX != null || focalY != null)
              ? { objectPosition: `${focalX ?? 50}% ${focalY ?? 50}%` }
              : undefined
          }
          className={cn(
            'w-full h-full transition-[filter,transform] duration-500',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            blurUp && !loaded && 'blur-lg scale-105',
            blurUp && loaded && 'blur-0 scale-100'
          )}
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
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
  Render: ({ props }) => <ImageFigure {...props} />,
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
      {(props.fit ?? 'cover') === 'cover' && (
        <Field label="Point focal" hint="Zone gardée visible au recadrage">
          <div className="grid w-max grid-cols-3 gap-1">
            {[0, 50, 100].map((y) =>
              [0, 50, 100].map((x) => {
                const active = (props.focalX ?? 50) === x && (props.focalY ?? 50) === y
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    title={`${x}% ${y}%`}
                    onClick={() => onChange({ focalX: x, focalY: y })}
                    className={cn(
                      'size-6 rounded border transition',
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border bg-muted hover:bg-muted-foreground/20'
                    )}
                  />
                )
              })
            )}
          </div>
        </Field>
      )}
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Apparition en fondu (blur-up)" className="flex-1">
          <span className="sr-only">blur-up</span>
        </Field>
        <Switch
          checked={props.blurUp ?? false}
          onCheckedChange={(v) => onChange({ blurUp: v })}
        />
      </div>
    </Group>
  ),
})
