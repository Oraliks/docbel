'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Eye, X as XIcon, Type as TypeIcon, Contrast, Check } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { a11yToolbarSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const a11yToolbar = defineBlock({
  type: 'a11yToolbar',
  schema,
  defaults: { position: 'bottom-right' },
  meta: {
    name: 'Barre d\'accessibilité',
    description: 'Outils d\'accessibilité (taille texte, contraste)',
    category: 'education',
    icon: 'eye',
    shortcuts: ['a11y', 'accessibility'],
  },
  Render: ({ props }) => {
    const {
      position = 'bottom-right',
      enableFontSizer = true,
      enableHighContrast = true,
      enableDyslexiaFont = true,
    } = props
    const [open, setOpen] = useState(false)
    const [fontScale, setFontScale] = useState(1)
    const [contrast, setContrast] = useState(false)
    const [dyslexia, setDyslexia] = useState(false)

    useEffect(() => {
      document.documentElement.style.fontSize = `${16 * fontScale}px`
      document.documentElement.classList.toggle('high-contrast', contrast)
      document.documentElement.classList.toggle('dyslexia-font', dyslexia)
      return () => {
        document.documentElement.style.fontSize = ''
        document.documentElement.classList.remove('high-contrast')
        document.documentElement.classList.remove('dyslexia-font')
      }
    }, [fontScale, contrast, dyslexia])

    return (
      <>
        <div
          className={cn(
            'fixed z-50',
            position === 'top-right' ? 'top-4 right-4' : 'bottom-4 right-4'
          )}
        >
          {open ? (
            <div className="rounded-2xl border bg-card shadow-2xl p-4 w-64 animate-in fade-in-0 slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Accessibilité</h4>
                <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100">
                  <XIcon className="size-4" />
                </button>
              </div>
              {enableFontSizer && (
                <div className="mb-3">
                  <div className="text-xs text-muted-foreground mb-1.5">Taille du texte</div>
                  <div className="flex gap-1">
                    {[0.85, 1, 1.15, 1.3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFontScale(s)}
                        className={cn(
                          'flex-1 rounded border py-1 text-xs',
                          fontScale === s ? 'border-primary bg-primary/10 text-primary' : ''
                        )}
                      >
                        {s === 1 ? 'A' : s < 1 ? 'A-' : s > 1.15 ? 'A++' : 'A+'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {enableHighContrast && (
                <button
                  onClick={() => setContrast((c) => !c)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-xs font-medium mb-2 flex items-center gap-2',
                    contrast && 'bg-primary/10 border-primary text-primary'
                  )}
                >
                  <Contrast className="size-4" />
                  Contraste élevé
                  {contrast && <Check className="size-3.5 ml-auto" />}
                </button>
              )}
              {enableDyslexiaFont && (
                <button
                  onClick={() => setDyslexia((d) => !d)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-xs font-medium flex items-center gap-2',
                    dyslexia && 'bg-primary/10 border-primary text-primary'
                  )}
                >
                  <TypeIcon className="size-4" />
                  Police adaptée dyslexie
                  {dyslexia && <Check className="size-3.5 ml-auto" />}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="size-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition flex items-center justify-center"
              title="Outils d'accessibilité"
            >
              <Eye className="size-5" />
            </button>
          )}
        </div>
        <style jsx global>{`
          .high-contrast {
            filter: contrast(1.4);
          }
          .dyslexia-font * {
            font-family: 'Atkinson Hyperlegible', 'Open Dyslexic', system-ui, sans-serif !important;
            letter-spacing: 0.04em;
            line-height: 1.7;
          }
        `}</style>
      </>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Réglages" defaultOpen>
      <Field label="Position">
        <Pills
          value={props.position ?? 'bottom-right'}
          onChange={(v) => onChange({ position: v as Props['position'] })}
          options={[
            { value: 'bottom-right', label: 'Bas-Droite' },
            { value: 'top-right', label: 'Haut-Droite' },
          ]}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Taille du texte" className="flex-1">
          <span className="sr-only">font sizer</span>
        </Field>
        <Switch
          checked={props.enableFontSizer ?? true}
          onCheckedChange={(v) => onChange({ enableFontSizer: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Contraste élevé" className="flex-1">
          <span className="sr-only">contrast</span>
        </Field>
        <Switch
          checked={props.enableHighContrast ?? true}
          onCheckedChange={(v) => onChange({ enableHighContrast: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Police dyslexie" className="flex-1">
          <span className="sr-only">dyslexia</span>
        </Field>
        <Switch
          checked={props.enableDyslexiaFont ?? true}
          onCheckedChange={(v) => onChange({ enableDyslexiaFont: v })}
        />
      </div>
    </Group>
  ),
})
