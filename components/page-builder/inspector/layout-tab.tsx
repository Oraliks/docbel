'use client'

import React from 'react'
import { Eye, EyeOff, Monitor, Tablet, Smartphone } from 'lucide-react'
import type { BlockProps, BlockLayout, DeviceType } from '@/lib/page-builder/types'
import { Field, Group, Pills, SpacingControl, NumberControl } from './controls'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LayoutTabProps {
  block: BlockProps
  device: DeviceType
  onChange: (layout: Partial<BlockLayout>) => void
}

// Largeurs rapides : preset → valeur CSS ('auto' = pas de largeur fixée).
const WIDTH_PRESETS: Record<string, string | undefined> = {
  auto: undefined,
  '25': '25%',
  '33': '33%',
  '50': '50%',
  '66': '66%',
  '75': '75%',
  '100': '100%',
}

function presetForWidth(width?: string): string {
  if (!width) return 'auto'
  const hit = Object.entries(WIDTH_PRESETS).find(([, v]) => v === width)
  return hit ? hit[0] : '' // '' = largeur personnalisée → aucun preset actif
}

export function LayoutTab({ block, device, onChange }: LayoutTabProps) {
  const layout = block.layout ?? {}
  return (
    <div>
      <Group title="Espacement intérieur (padding)" defaultOpen>
        <SpacingControl
          values={{
            top: layout.paddingTop,
            right: layout.paddingRight,
            bottom: layout.paddingBottom,
            left: layout.paddingLeft,
          }}
          onChange={(next) =>
            onChange({
              paddingTop: next.top,
              paddingRight: next.right,
              paddingBottom: next.bottom,
              paddingLeft: next.left,
            })
          }
        />
      </Group>

      <Group title="Espacement extérieur (margin)">
        <SpacingControl
          values={{
            top: layout.marginTop,
            right: layout.marginRight,
            bottom: layout.marginBottom,
            left: layout.marginLeft,
          }}
          onChange={(next) =>
            onChange({
              marginTop: next.top,
              marginRight: next.right,
              marginBottom: next.bottom,
              marginLeft: next.left,
            })
          }
        />
      </Group>

      <Group title="Dimensions">
        <Field
          label="Largeur rapide"
          hint="Rétrécir le bloc — combinez avec l'alignement ci-dessous"
        >
          <Pills
            value={presetForWidth(layout.width)}
            onChange={(v) => onChange({ width: WIDTH_PRESETS[v] })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: '25', label: '¼' },
              { value: '33', label: '⅓' },
              { value: '50', label: '½' },
              { value: '66', label: '⅔' },
              { value: '75', label: '¾' },
              { value: '100', label: '100%' },
            ]}
          />
        </Field>
        <Field label="Largeur (précis)" hint="Ex: 320px, 100%, auto">
          <Input
            value={layout.width ?? ''}
            onChange={(e) => onChange({ width: e.target.value || undefined })}
            placeholder="auto"
            className="h-8"
          />
        </Field>
        <Field label="Largeur max">
          <Input
            value={layout.maxWidth ?? ''}
            onChange={(e) => onChange({ maxWidth: e.target.value || undefined })}
            placeholder="aucune"
            className="h-8"
          />
        </Field>
        <Field label="Hauteur min">
          <Input
            value={layout.minHeight ?? ''}
            onChange={(e) => onChange({ minHeight: e.target.value || undefined })}
            placeholder="auto"
            className="h-8"
          />
        </Field>
        <Field label="Colonnes occupées (en grille)" hint="Largeur de ce bloc dans un parent en grille">
          <NumberControl
            value={layout.gridColumnSpan}
            onChange={(v) => onChange({ gridColumnSpan: v })}
            min={1}
            max={6}
            suffix="col"
            placeholder="auto"
          />
        </Field>
      </Group>

      <Group title="Alignement">
        <Field label="Position du bloc">
          <Pills
            value={layout.align ?? 'stretch'}
            onChange={(v) => onChange({ align: v })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Droite' },
              { value: 'stretch', label: 'Étirer' },
            ]}
          />
        </Field>
      </Group>

      <Group title="Position">
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Coller au défilement (sticky)" className="flex-1">
            <span className="sr-only">sticky</span>
          </Field>
          <Switch
            checked={layout.sticky ?? false}
            onCheckedChange={(v) => onChange({ sticky: v })}
          />
        </div>
        {layout.sticky && (
          <Field label="Décalage haut (sticky)">
            <NumberControl
              value={layout.stickyOffset}
              onChange={(v) => onChange({ stickyOffset: v })}
              min={0}
              max={300}
              suffix="px"
              placeholder="0"
            />
          </Field>
        )}
        <Field label="Profondeur (z-index)" hint="Plus élevé = passe au-dessus des autres blocs">
          <NumberControl
            value={layout.zIndex}
            onChange={(v) => onChange({ zIndex: v })}
            min={0}
            max={1000}
            placeholder="auto"
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field
            label="Position libre (X/Y)"
            className="flex-1"
            hint="Le conteneur parent doit être en « disposition libre »"
          >
            <span className="sr-only">Position absolue</span>
          </Field>
          <Switch
            checked={layout.absolute ?? false}
            onCheckedChange={(v) => onChange({ absolute: v })}
          />
        </div>
        {layout.absolute && (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberControl
              value={layout.left}
              onChange={(v) => onChange({ left: v })}
              suffix="X"
              placeholder="0"
              min={-2000}
              max={5000}
            />
            <NumberControl
              value={layout.top}
              onChange={(v) => onChange({ top: v })}
              suffix="Y"
              placeholder="0"
              min={-2000}
              max={5000}
            />
          </div>
        )}
      </Group>

      <Group title="Visibilité par appareil">
        <p className="text-[11px] text-muted-foreground mb-2">
          Masquer ce bloc sur certains appareils.
        </p>
        <DeviceVisibilityRow
          icon={<Monitor className="size-3.5" />}
          label="Desktop"
          hidden={layout.hideOnDesktop ?? false}
          onChange={(v) => onChange({ hideOnDesktop: v })}
          active={device === 'desktop'}
        />
        <DeviceVisibilityRow
          icon={<Tablet className="size-3.5" />}
          label="Tablette"
          hidden={layout.hideOnTablet ?? false}
          onChange={(v) => onChange({ hideOnTablet: v })}
          active={device === 'tablet'}
        />
        <DeviceVisibilityRow
          icon={<Smartphone className="size-3.5" />}
          label="Mobile"
          hidden={layout.hideOnMobile ?? false}
          onChange={(v) => onChange({ hideOnMobile: v })}
          active={device === 'mobile'}
        />
      </Group>
    </div>
  )
}

function DeviceVisibilityRow({
  icon,
  label,
  hidden,
  onChange,
  active,
}: {
  icon: React.ReactNode
  label: string
  hidden: boolean
  onChange: (v: boolean) => void
  active: boolean
}) {
  return (
    <div
      className={
        'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ' +
        (active ? 'bg-muted/60' : '')
      }
    >
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <Label className="cursor-pointer">{label}</Label>
        {active && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">actuel</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hidden ? (
          <EyeOff className="size-3.5 text-muted-foreground" />
        ) : (
          <Eye className="size-3.5 text-muted-foreground" />
        )}
        <Switch checked={!hidden} onCheckedChange={(v) => onChange(!v)} />
      </div>
    </div>
  )
}
