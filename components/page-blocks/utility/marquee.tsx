'use client'

import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  ColorControl,
  Field,
  Group,
  Pills,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  text: z.string().max(2000).default(''),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  reverse: z.boolean().optional(),
  color: z.string().optional(),
})

type Props = z.infer<typeof schema>

const DURATION: Record<NonNullable<Props['speed']>, string> = {
  slow: '40s',
  normal: '20s',
  fast: '10s',
}

export const marquee = defineBlock({
  type: 'marquee',
  schema,
  defaults: {
    text: '✨ Annonce importante · Nouveauté · Ne manquez pas ça · ',
    speed: 'normal',
    reverse: false,
    color: '#C8102E',
  },
  meta: {
    name: 'Texte défilant',
    description: 'Bandeau qui défile en boucle',
    category: 'utility',
    icon: 'arrow-right',
    shortcuts: ['marquee', 'defile'],
  },
  Render: ({ props }) => {
    const { text, speed = 'normal', reverse, color } = props
    const segments = Array.from({ length: 4 }).map((_, i) => (
      <span key={i} className="inline-block">
        {text}
      </span>
    ))
    return (
      <div
        className="my-2 overflow-hidden whitespace-nowrap py-3 border-y"
        style={{ color: color || undefined }}
      >
        <div
          className="inline-flex gap-12 font-bold text-lg"
          style={{
            animation: `marquee ${DURATION[speed]} linear infinite`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        >
          {segments}
        </div>
        <style jsx>{`
          @keyframes marquee {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Texte">
        <Input value={props.text} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Vitesse">
        <Pills
          value={props.speed ?? 'normal'}
          onChange={(v) => onChange({ speed: v as Props['speed'] })}
          options={[
            { value: 'slow', label: 'Lente' },
            { value: 'normal', label: 'Normale' },
            { value: 'fast', label: 'Rapide' },
          ]}
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Sens inversé" className="flex-1">
          <span className="sr-only">reverse</span>
        </Field>
        <Switch
          checked={props.reverse ?? false}
          onCheckedChange={(v) => onChange({ reverse: v })}
        />
      </div>
    </Group>
  ),
})
