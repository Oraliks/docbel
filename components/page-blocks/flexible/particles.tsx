'use client'

import { useState } from 'react'
import { z } from 'zod'
import {
  ColorControl,
  Field,
  Group,
  Pills,
  SliderControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'

const schema = z.object({
  count: z.number().min(5).max(200).optional(),
  color: z.string().optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
})

type Props = z.infer<typeof schema>

export const particles = defineBlock({
  type: 'particles',
  schema,
  defaults: { count: 40, color: '#7C3AED', speed: 'normal' },
  meta: {
    name: 'Particules',
    description: 'Fond animé de particules',
    category: 'decorative',
    icon: 'sparkles',
    shortcuts: ['particles'],
  },
  Render: ({ props }) => {
    const { count = 40, color = '#7C3AED', speed = 'normal' } = props
    const [list] = useState(() =>
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 10,
        duration: 5 + Math.random() * (speed === 'slow' ? 15 : speed === 'fast' ? 5 : 10),
        tx: Math.random() * 40 - 20,
        ty: Math.random() * 40 - 20,
      }))
    )
    return (
      <div className="relative my-2 h-48 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-primary/20">
        {list.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: color,
              opacity: 0.6,
              animation: `float-${i} ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
        <style jsx>{`
          ${list
            .map(
              (p, i) => `
            @keyframes float-${i} {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(${p.tx}px, ${p.ty}px); }
            }
          `
            )
            .join('')}
        `}</style>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nombre de particules">
        <SliderControl
          value={props.count ?? 40}
          onChange={(v) => onChange({ count: v })}
          min={5}
          max={150}
        />
      </Field>
      <Field label="Couleur">
        <ColorControl value={props.color} onChange={(v) => onChange({ color: v })} />
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
    </Group>
  ),
})
