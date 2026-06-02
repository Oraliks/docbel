'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { countdownSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

export const countdown = defineBlock({
  type: 'countdown',
  schema,
  defaults: {
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Plus que',
    variant: 'large',
    expiredMessage: 'Terminé !',
  },
  meta: {
    name: 'Compte à rebours',
    description: 'Décompte vers une date',
    category: 'marketing',
    icon: 'clock',
    shortcuts: ['countdown', 'timer'],
  },
  Render: ({ props }) => {
    const { targetDate, title, variant = 'large', expiredMessage = 'Terminé !' } = props
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000)
      return () => clearInterval(t)
    }, [])
    const target = new Date(targetDate).getTime()
    const diff = Math.max(0, target - now)
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    if (diff === 0) {
      return (
        <div className="rounded-2xl border bg-card p-8 text-center my-2">
          <p className="text-lg font-semibold">{expiredMessage}</p>
        </div>
      )
    }

    if (variant === 'compact') {
      return (
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 my-2 font-mono text-sm">
          {title && <span className="text-muted-foreground">{title}</span>}
          <span>{days}j</span>
          <span>{String(hours).padStart(2, '0')}h</span>
          <span>{String(minutes).padStart(2, '0')}m</span>
          <span>{String(seconds).padStart(2, '0')}s</span>
        </div>
      )
    }

    return (
      <div className="my-4 text-center">
        {title && (
          <p className="text-sm uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
        )}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-lg mx-auto">
          {[
            { label: 'Jours', value: days },
            { label: 'Heures', value: hours },
            { label: 'Min', value: minutes },
            { label: 'Sec', value: seconds },
          ].map((unit) => (
            <div key={unit.label} className="rounded-2xl border bg-card p-3 sm:p-4">
              <div className="text-3xl sm:text-5xl font-bold tracking-tight tabular-nums">
                {String(unit.value).padStart(2, '0')}
              </div>
              <div className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
                {unit.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Titre">
        <Input
          value={props.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Date cible (ISO)">
        <Input
          type="datetime-local"
          value={props.targetDate ? new Date(props.targetDate).toISOString().slice(0, 16) : ''}
          onChange={(e) => onChange({ targetDate: new Date(e.target.value).toISOString() })}
          className="font-mono text-xs"
        />
      </Field>
      <Field label="Variant">
        <Pills
          value={props.variant ?? 'large'}
          onChange={(v) => onChange({ variant: v as Props['variant'] })}
          options={[
            { value: 'large', label: 'Large' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </Field>
      <Field label="Message à expiration">
        <Input
          value={props.expiredMessage ?? ''}
          onChange={(e) => onChange({ expiredMessage: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
