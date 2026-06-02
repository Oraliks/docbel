'use client'

import type { CSSProperties } from 'react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  Pills,
} from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { sectionSchema as schema } from './schemas'

export const section = defineBlock({
  type: 'section',
  schema,
  defaults: { bgType: 'color', bgColor: '#F9F9F7', fullWidth: true },
  meta: {
    name: 'Section',
    description: 'Section pleine largeur avec fond',
    category: 'layout',
    icon: 'square',
    shortcuts: ['section'],
    canHaveChildren: true,
  },
  Render: ({ props, slot }) => {
    const { bgType = 'color', bgColor, bgGradient, bgImage, bgOverlay, fullWidth = true } = props
    const bgStyle: CSSProperties = {}
    if (bgType === 'color' && bgColor) bgStyle.backgroundColor = bgColor
    if (bgType === 'gradient' && bgGradient) bgStyle.backgroundImage = bgGradient
    if (bgType === 'image' && bgImage) {
      bgStyle.backgroundImage = `url(${bgImage})`
      bgStyle.backgroundSize = 'cover'
      bgStyle.backgroundPosition = 'center'
    }
    return (
      <section
        className={cn('relative w-full', fullWidth ? '' : 'rounded-2xl overflow-hidden')}
        style={bgStyle}
      >
        {bgOverlay && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: bgOverlay }}
            aria-hidden
          />
        )}
        <div className="relative py-8 md:py-12">{slot}</div>
      </section>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Type de fond">
        <Pills
          value={props.bgType ?? 'color'}
          onChange={(v) => onChange({ bgType: v as typeof props.bgType })}
          options={[
            { value: 'none', label: 'Aucun' },
            { value: 'color', label: 'Couleur' },
            { value: 'gradient', label: 'Dégradé' },
            { value: 'image', label: 'Image' },
          ]}
        />
      </Field>
      {props.bgType === 'color' && (
        <Field label="Couleur de fond">
          <ColorControl value={props.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
      )}
      {props.bgType === 'gradient' && (
        <Field label="Dégradé CSS" hint="Ex: linear-gradient(135deg, #7C3AED, #1A1A24)">
          <Input
            value={props.bgGradient ?? ''}
            onChange={(e) => onChange({ bgGradient: e.target.value })}
            placeholder="linear-gradient(…)"
            className="font-mono text-xs"
          />
        </Field>
      )}
      {props.bgType === 'image' && (
        <>
          <Field label="Image de fond">
            <ImageUpload
              value={props.bgImage ?? ''}
              onChange={(url) => onChange({ bgImage: url })}
            />
          </Field>
          <Field label="Overlay (assombrir)">
            <ColorControl value={props.bgOverlay} onChange={(v) => onChange({ bgOverlay: v })} />
          </Field>
        </>
      )}
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Pleine largeur" className="flex-1">
          <span className="sr-only">Full width</span>
        </Field>
        <Switch
          checked={props.fullWidth ?? true}
          onCheckedChange={(v) => onChange({ fullWidth: v })}
        />
      </div>
    </Group>
  ),
})
