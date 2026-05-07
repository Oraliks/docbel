'use client'

import React from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
} from 'lucide-react'
import type { BlockProps, BlockStyle } from '@/lib/page-builder/types'
import { Field, Group, Pills, ColorControl, SliderControl, NumberControl } from './controls'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DesignTabProps {
  block: BlockProps
  onChange: (style: Partial<BlockStyle>) => void
}

export function DesignTab({ block, onChange }: DesignTabProps) {
  const style = block.style ?? {}
  return (
    <div>
      <Group title="Typographie" defaultOpen>
        <Field label="Couleur du texte">
          <ColorControl value={style.textColor} onChange={(v) => onChange({ textColor: v })} />
        </Field>
        <Field label="Alignement">
          <Pills
            value={style.textAlign ?? undefined}
            onChange={(v) => onChange({ textAlign: v })}
            options={[
              { value: 'left', label: <AlignLeft className="size-3.5" /> },
              { value: 'center', label: <AlignCenter className="size-3.5" /> },
              { value: 'right', label: <AlignRight className="size-3.5" /> },
              { value: 'justify', label: <AlignJustify className="size-3.5" /> },
            ]}
          />
        </Field>
        <Field label="Taille de police">
          <NumberControl
            value={style.fontSize}
            onChange={(v) => onChange({ fontSize: v })}
            min={8}
            max={120}
            placeholder="auto"
          />
        </Field>
        <Field label="Graisse">
          <Select
            value={String(style.fontWeight ?? '')}
            onValueChange={(v) =>
              onChange({ fontWeight: v ? (Number(v) as BlockStyle['fontWeight']) : undefined })
            }
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Auto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="300">Light (300)</SelectItem>
              <SelectItem value="400">Regular (400)</SelectItem>
              <SelectItem value="500">Medium (500)</SelectItem>
              <SelectItem value="600">Semibold (600)</SelectItem>
              <SelectItem value="700">Bold (700)</SelectItem>
              <SelectItem value="800">Extrabold (800)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Hauteur de ligne">
          <SliderControl
            value={style.lineHeight ?? 1.5}
            onChange={(v) => onChange({ lineHeight: v })}
            min={0.8}
            max={3}
            step={0.05}
          />
        </Field>
      </Group>

      <Group title="Fond" defaultOpen>
        <Field label="Couleur de fond">
          <ColorControl value={style.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
      </Group>

      <Group title="Bordure">
        <Field label="Épaisseur">
          <NumberControl
            value={style.borderWidth}
            onChange={(v) => onChange({ borderWidth: v })}
            min={0}
            max={20}
          />
        </Field>
        <Field label="Couleur">
          <ColorControl value={style.borderColor} onChange={(v) => onChange({ borderColor: v })} />
        </Field>
        <Field label="Style">
          <Pills
            value={style.borderStyle ?? 'solid'}
            onChange={(v) => onChange({ borderStyle: v })}
            options={[
              { value: 'solid', label: 'Solid' },
              { value: 'dashed', label: 'Dashed' },
              { value: 'dotted', label: 'Dotted' },
            ]}
          />
        </Field>
        <Field label="Coins arrondis">
          <SliderControl
            value={style.borderRadius ?? 0}
            onChange={(v) => onChange({ borderRadius: v })}
            min={0}
            max={80}
            suffix="px"
          />
        </Field>
      </Group>

      <Group title="Effets">
        <Field label="Ombre">
          <Pills
            value={style.shadow ?? 'none'}
            onChange={(v) => onChange({ shadow: v })}
            options={[
              { value: 'none', label: 'Aucune' },
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
              { value: 'xl', label: 'XL' },
            ]}
          />
        </Field>
        <Field label="Opacité">
          <SliderControl
            value={style.opacity ?? 1}
            onChange={(v) => onChange({ opacity: v })}
            min={0}
            max={1}
            step={0.05}
          />
        </Field>
      </Group>
    </div>
  )
}
