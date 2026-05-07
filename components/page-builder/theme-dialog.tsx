'use client'

import React from 'react'
import { Palette, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Group, ColorControl, SliderControl } from './inspector/controls'
import { Input } from '@/components/ui/input'
import { THEME_PRESETS } from './theme-tokens'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { ThemeTokens } from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

interface ThemeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemeDialog({ open, onOpenChange }: ThemeDialogProps) {
  const tokens = usePageBuilderStore((s) => s.themeTokens)
  const setTokens = usePageBuilderStore((s) => s.setThemeTokens)

  const update = (patch: Partial<ThemeTokens>) => {
    setTokens({ ...(tokens ?? {}), ...patch })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="size-4" />
            Thème de la page
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Presets */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Presets
            </h4>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setTokens(null)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
                  !tokens ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                )}
              >
                <span className="size-4 rounded-full bg-muted border" />
                Défaut (Docbel)
                {!tokens && <Check className="ml-auto size-3.5 text-primary" />}
              </button>
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setTokens(preset.tokens)}
                  className="w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:border-primary hover:bg-primary/5"
                >
                  <span
                    className="size-4 rounded-full border"
                    style={{ backgroundColor: preset.tokens.primary }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Personnaliser
            </h4>
            <Group title="Couleurs" defaultOpen>
              <Field label="Primaire">
                <ColorControl value={tokens?.primary} onChange={(v) => update({ primary: v })} />
              </Field>
              <Field label="Accent">
                <ColorControl value={tokens?.accent} onChange={(v) => update({ accent: v })} />
              </Field>
              <Field label="Fond">
                <ColorControl value={tokens?.background} onChange={(v) => update({ background: v })} />
              </Field>
              <Field label="Texte">
                <ColorControl value={tokens?.foreground} onChange={(v) => update({ foreground: v })} />
              </Field>
            </Group>
            <Group title="Typo & rayon">
              <Field label="Police (CSS font-family)">
                <Input
                  value={tokens?.fontFamily ?? ''}
                  onChange={(e) => update({ fontFamily: e.target.value || undefined })}
                  placeholder="Inter, system-ui, sans-serif"
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Rayon de bordure">
                <SliderControl
                  value={tokens?.radius ?? 10}
                  onChange={(v) => update({ radius: v })}
                  min={0}
                  max={30}
                  suffix="px"
                />
              </Field>
            </Group>
          </div>
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Affecte uniquement cette page. Les changements sont sauvegardés automatiquement.
          </p>
          <Button variant="outline" size="sm" onClick={() => setTokens(null)}>
            Réinitialiser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
