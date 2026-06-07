'use client'

import { useEffect, type ElementType } from 'react'
import { Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group, SliderControl } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { lottieSchema as schema } from './schemas'

// TS ne connaît pas l'élément custom <lottie-player> (web component chargé
// via CDN). On aliase le tag en ElementType pour le rendre comme un composant
// JSX standard, sans déclaration de type globale ni augmentation de JSX.
const LottiePlayer = 'lottie-player' as unknown as ElementType

const PLAYER_SRC =
  'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js'

export const lottie = defineBlock({
  type: 'lottie',
  schema,
  defaults: { src: '', loop: true, autoplay: true },
  meta: {
    name: 'Lottie',
    description: 'Animation Lottie',
    category: 'media',
    icon: 'sparkles',
    shortcuts: ['lottie', 'animation'],
  },
  Render: ({ props }) => {
    const { src, loop = true, autoplay = true, speed } = props

    // Injecte le script du web component une seule fois (côté client).
    useEffect(() => {
      if (typeof document === 'undefined') return
      if (document.querySelector('script[data-lottie-player]')) return
      const s = document.createElement('script')
      s.src = PLAYER_SRC
      s.setAttribute('data-lottie-player', '')
      s.async = true
      document.body.appendChild(s)
    }, [])

    if (!src) {
      return (
        <div className="rounded-lg border border-dashed bg-muted px-4 py-6 text-sm text-muted-foreground flex items-center gap-3">
          <Sparkles className="size-5" />
          Lottie non configuré
        </div>
      )
    }

    return (
      <div className="my-2 w-full">
        <LottiePlayer
          src={src}
          background="transparent"
          speed={speed}
          style={{ width: '100%' }}
          {...(autoplay ? { autoplay: true } : {})}
          {...(loop ? { loop: true } : {})}
        />
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Animation" defaultOpen>
      <Field label="URL Lottie" hint="Fichier .json ou .lottie">
        <Input
          value={props.src}
          onChange={(e) => onChange({ src: e.target.value })}
          placeholder="https://…/animation.json"
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Boucle" className="flex-1">
          <span className="sr-only">loop</span>
        </Field>
        <Switch
          checked={props.loop ?? true}
          onCheckedChange={(v) => onChange({ loop: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Lecture automatique" className="flex-1">
          <span className="sr-only">autoplay</span>
        </Field>
        <Switch
          checked={props.autoplay ?? true}
          onCheckedChange={(v) => onChange({ autoplay: v })}
        />
      </div>
      <Field label="Vitesse">
        <SliderControl
          value={props.speed ?? 1}
          onChange={(v) => onChange({ speed: v })}
          min={0.1}
          max={3}
          step={0.1}
          suffix="×"
        />
      </Field>
    </Group>
  ),
})
