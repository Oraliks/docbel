'use client'

import React from 'react'
import { Eye, EyeOff, Monitor, Tablet, Smartphone } from 'lucide-react'
import type { BlockProps, BlockLayout, DeviceType } from '@/lib/page-builder/types'
import { Field, Group, Pills, SpacingControl } from './controls'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LayoutTabProps {
  block: BlockProps
  device: DeviceType
  onChange: (layout: Partial<BlockLayout>) => void
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
        <Field label="Largeur" hint="Ex: 100%, 320px, auto">
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
