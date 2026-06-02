'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Field, Group, Pills } from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { lastUpdatedSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

function Inner({
  date,
  format,
  prefix,
}: {
  date: string
  format: NonNullable<Props['format']>
  prefix: string
}) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
  }, [])
  const d = new Date(date)
  let formatted = ''
  if (format === 'long') {
    formatted = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } else if (format === 'short') {
    formatted = new Intl.DateTimeFormat('fr-FR').format(d)
  } else {
    if (now === null) {
      formatted = new Intl.DateTimeFormat('fr-FR').format(d)
    } else {
      const diff = now - d.getTime()
      const days = Math.floor(diff / 86400000)
      if (days < 1) formatted = 'aujourd’hui'
      else if (days < 7) formatted = `il y a ${days} jour${days > 1 ? 's' : ''}`
      else if (days < 30)
        formatted = `il y a ${Math.floor(days / 7)} semaine${days >= 14 ? 's' : ''}`
      else formatted = `il y a ${Math.floor(days / 30)} mois`
    }
  }
  return (
    <p className="text-xs text-muted-foreground my-1">
      {prefix} {formatted}
    </p>
  )
}

export const lastUpdated = defineBlock({
  type: 'lastUpdated',
  schema,
  defaults: { format: 'long', prefix: 'Mis à jour' },
  meta: {
    name: 'Dernière mise à jour',
    description: 'Tampon date de mise à jour',
    category: 'navigation',
    icon: 'clock',
    shortcuts: ['updated', 'misajour'],
  },
  Render: ({ props }) => {
    const { date, format = 'long', prefix = 'Mis à jour' } = props
    if (!date) {
      return (
        <p className="text-xs text-muted-foreground italic">
          {prefix} : (date de mise à jour de la page)
        </p>
      )
    }
    return <Inner date={date} format={format} prefix={prefix} />
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Date (laisser vide pour utiliser la page)">
        <Input
          type="date"
          value={props.date ? props.date.slice(0, 10) : ''}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </Field>
      <Field label="Format">
        <Pills
          value={props.format ?? 'long'}
          onChange={(v) => onChange({ format: v as Props['format'] })}
          options={[
            { value: 'long', label: 'Complet' },
            { value: 'short', label: 'Court' },
            { value: 'relative', label: 'Relatif' },
          ]}
        />
      </Field>
      <Field label="Préfixe">
        <Input
          value={props.prefix ?? ''}
          onChange={(e) => onChange({ prefix: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
