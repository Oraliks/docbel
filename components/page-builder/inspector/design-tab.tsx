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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ImageUpload } from './image-upload'

interface DesignTabProps {
  block: BlockProps
  onChange: (style: Partial<BlockStyle>) => void
}

export function DesignTab({ block, onChange }: DesignTabProps) {
  const style = block.style ?? {}
  const hv = style.hoverState ?? {}
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
        <Field label="Interlettrage">
          <SliderControl
            value={style.letterSpacing ?? 0}
            onChange={(v) => onChange({ letterSpacing: v })}
            min={-2}
            max={10}
            step={0.5}
            suffix="px"
          />
        </Field>
        <Field label="Police">
          <Select
            value={style.fontFamily ?? ''}
            onValueChange={(v) => onChange({ fontFamily: v || undefined })}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Auto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ui-sans-serif, system-ui, sans-serif">Sans-serif</SelectItem>
              <SelectItem value="ui-serif, Georgia, Cambria, serif">Serif</SelectItem>
              <SelectItem value="ui-monospace, SFMono-Regular, monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Effet de texte" hint="Le dégradé reprend les couleurs du fond dégradé">
          <Select
            value={style.textEffect ?? 'none'}
            onValueChange={(v) =>
              onChange({
                textEffect: (v === 'none' ? undefined : v) as BlockStyle['textEffect'],
              })
            }
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun</SelectItem>
              <SelectItem value="gradient">Dégradé</SelectItem>
              <SelectItem value="shadow">Ombre</SelectItem>
              <SelectItem value="glow">Lueur</SelectItem>
              <SelectItem value="outline">Contour</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Group>

      <Group title="Fond" defaultOpen>
        <Field label="Couleur de fond">
          <ColorControl value={style.bgColor} onChange={(v) => onChange({ bgColor: v })} />
        </Field>
      </Group>

      <Group title="Fond — dégradé">
        <p className="text-[11px] text-muted-foreground">
          Si défini, le dégradé recouvre la couleur de fond.
        </p>
        <Field label="Couleur de départ">
          <ColorControl
            value={style.bgGradientFrom}
            onChange={(v) => onChange({ bgGradientFrom: v })}
          />
        </Field>
        <Field label="Couleur d'arrivée">
          <ColorControl
            value={style.bgGradientTo}
            onChange={(v) => onChange({ bgGradientTo: v })}
          />
        </Field>
        <Field label="Angle">
          <SliderControl
            value={style.bgGradientAngle ?? 135}
            onChange={(v) => onChange({ bgGradientAngle: v })}
            min={0}
            max={360}
            suffix="°"
          />
        </Field>
      </Group>

      <Group title="Fond — image">
        <p className="text-[11px] text-muted-foreground">
          Si définie, l’image recouvre la couleur et le dégradé.
        </p>
        <Field label="Image">
          <ImageUpload
            value={style.bgImage ?? ''}
            onChange={(url) => onChange({ bgImage: url || undefined })}
          />
        </Field>
        {style.bgImage && (
          <>
            <Field label="Cadrage">
              <Pills
                value={style.bgImageSize ?? 'cover'}
                onChange={(v) => onChange({ bgImageSize: v })}
                options={[
                  { value: 'cover', label: 'Couvrir' },
                  { value: 'contain', label: 'Contenir' },
                  { value: 'auto', label: 'Auto' },
                ]}
              />
            </Field>
            <Field label="Position">
              <Pills
                value={style.bgImagePosition ?? 'center'}
                onChange={(v) => onChange({ bgImagePosition: v })}
                options={[
                  { value: 'center', label: 'Centre' },
                  { value: 'top', label: 'Haut' },
                  { value: 'bottom', label: 'Bas' },
                  { value: 'left', label: 'G.' },
                  { value: 'right', label: 'D.' },
                ]}
              />
            </Field>
            <Field label="Overlay (assombrir)">
              <ColorControl
                value={style.bgOverlay}
                onChange={(v) => onChange({ bgOverlay: v })}
              />
            </Field>
            {style.bgOverlay && (
              <Field label="Opacité de l'overlay">
                <SliderControl
                  value={style.bgOverlayOpacity ?? 0.4}
                  onChange={(v) => onChange({ bgOverlayOpacity: v })}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </Field>
            )}
          </>
        )}
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
        <Field label="Bordure dégradée — départ" hint="Définir départ + arrivée pour activer">
          <ColorControl
            value={style.borderGradientFrom}
            onChange={(v) => onChange({ borderGradientFrom: v })}
          />
        </Field>
        <Field label="Bordure dégradée — arrivée">
          <ColorControl
            value={style.borderGradientTo}
            onChange={(v) => onChange({ borderGradientTo: v })}
          />
        </Field>
        <Field label="Bordure dégradée — angle">
          <SliderControl
            value={style.borderGradientAngle ?? 90}
            onChange={(v) => onChange({ borderGradientAngle: v })}
            min={0}
            max={360}
            suffix="°"
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
        <Field label="Couleur de l'ombre">
          <ColorControl
            value={style.shadowColor}
            onChange={(v) => onChange({ shadowColor: v })}
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Ombre intérieure" className="flex-1">
            <span className="sr-only">Ombre intérieure (inset)</span>
          </Field>
          <Switch
            checked={style.shadowInset ?? false}
            onCheckedChange={(v) => onChange({ shadowInset: v })}
          />
        </div>
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

      <Group title="Effets avancés">
        <Field label="Flou d'arrière-plan" hint="Effet verre dépoli (backdrop-blur)">
          <SliderControl
            value={style.backdropBlur ?? 0}
            onChange={(v) => onChange({ backdropBlur: v })}
            min={0}
            max={30}
            suffix="px"
          />
        </Field>
        <Field label="Mode de fusion">
          <Select
            value={style.mixBlendMode ?? 'normal'}
            onValueChange={(v) =>
              onChange({
                mixBlendMode: v === 'normal' ? undefined : (v as BlockStyle['mixBlendMode']),
              })
            }
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Normal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="multiply">Multiply</SelectItem>
              <SelectItem value="screen">Screen</SelectItem>
              <SelectItem value="overlay">Overlay</SelectItem>
              <SelectItem value="darken">Darken</SelectItem>
              <SelectItem value="lighten">Lighten</SelectItem>
              <SelectItem value="difference">Difference</SelectItem>
              <SelectItem value="soft-light">Soft light</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Forme (clip-path)" hint="Ex : circle(50%) ou polygon(0 0,100% 0,100% 80%,0 100%)">
          <Input
            value={style.clipPath ?? ''}
            onChange={(e) => onChange({ clipPath: e.target.value || undefined })}
            placeholder="circle(50%)"
            className="font-mono text-xs"
          />
        </Field>
      </Group>

      <Group title="Effets au survol">
        <p className="text-[11px] text-muted-foreground">
          Style appliqué quand la souris passe sur le bloc (transition douce auto).
        </p>
        <Field label="Couleur du texte">
          <ColorControl
            value={hv.textColor}
            onChange={(v) => onChange({ hoverState: { ...hv, textColor: v } })}
          />
        </Field>
        <Field label="Couleur de fond">
          <ColorControl
            value={hv.bgColor}
            onChange={(v) => onChange({ hoverState: { ...hv, bgColor: v } })}
          />
        </Field>
        <Field label="Couleur de bordure">
          <ColorControl
            value={hv.borderColor}
            onChange={(v) => onChange({ hoverState: { ...hv, borderColor: v } })}
          />
        </Field>
        <Field label="Échelle (zoom)">
          <SliderControl
            value={hv.scale ?? 1}
            onChange={(v) => onChange({ hoverState: { ...hv, scale: v } })}
            min={0.9}
            max={1.2}
            step={0.01}
          />
        </Field>
        <Field label="Élévation">
          <SliderControl
            value={hv.lift ?? 0}
            onChange={(v) => onChange({ hoverState: { ...hv, lift: v } })}
            min={0}
            max={24}
            suffix="px"
          />
        </Field>
        <Field label="Opacité">
          <SliderControl
            value={hv.opacity ?? 1}
            onChange={(v) => onChange({ hoverState: { ...hv, opacity: v } })}
            min={0}
            max={1}
            step={0.05}
          />
        </Field>
        <Field label="Ombre">
          <Pills
            value={hv.shadow ?? 'none'}
            onChange={(v) => onChange({ hoverState: { ...hv, shadow: v } })}
            options={[
              { value: 'none', label: 'Aucune' },
              { value: 'sm', label: 'Sm' },
              { value: 'md', label: 'Md' },
              { value: 'lg', label: 'Lg' },
              { value: 'xl', label: 'XL' },
            ]}
          />
        </Field>
      </Group>
    </div>
  )
}
