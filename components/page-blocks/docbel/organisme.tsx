'use client'

/* eslint-disable @next/next/no-img-element */

import type { ElementType } from 'react'
import { z } from 'zod'
import { MapPin, Phone, Mail, Globe, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { cn } from '@/lib/utils'
import { organismeSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

function InfoRow({
  icon: Icon,
  value,
  href,
  external,
}: {
  icon: ElementType
  value: string
  href?: string
  external?: boolean
}) {
  const content = (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />
      <span className={cn('flex-1 min-w-0', href && 'group-hover:text-primary')}>{value}</span>
    </div>
  )
  if (!href) return content
  return (
    <a
      href={safeHref(href)}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="group hover:text-primary transition"
    >
      {content}
    </a>
  )
}

export const organisme = defineBlock({
  type: 'organisme',
  schema,
  defaults: {
    name: 'Nom de l’organisme',
    description: 'Présentation de l’organisme.',
    address: 'Adresse complète',
    phone: '',
    email: '',
    website: '',
    hours: '',
    logo: '',
    variant: 'card',
  },
  meta: {
    name: 'Organisme',
    description: 'Fiche contact d’un organisme',
    category: 'docbel',
    icon: 'square',
    shortcuts: ['organisme', 'contact'],
    variants: [
      { id: 'card', name: 'Carte' },
      { id: 'compact', name: 'Compact' },
      { id: 'detailed', name: 'Détaillé' },
    ],
  },
  Render: ({ props }) => {
    const {
      name,
      description,
      address,
      phone,
      email,
      website,
      hours,
      logo,
      variant = 'card',
    } = props

    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          {logo ? (
            <img src={logo} alt="" className="size-10 rounded object-cover shrink-0" />
          ) : (
            <div className="size-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="size-4 text-primary" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{name}</div>
            {address && <div className="text-xs text-muted-foreground truncate">{address}</div>}
          </div>
          {phone && (
            <a href={`tel:${phone}`} className="text-sm text-primary hover:underline shrink-0">
              {phone}
            </a>
          )}
        </div>
      )
    }

    return (
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex gap-4 items-start">
          {logo ? (
            <img src={logo} alt="" className="size-14 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="size-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="size-6 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">{name}</h3>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        <div className={cn('mt-4 grid gap-3', variant === 'detailed' ? 'sm:grid-cols-2' : '')}>
          {address && <InfoRow icon={MapPin} value={address} />}
          {phone && <InfoRow icon={Phone} value={phone} href={`tel:${phone}`} />}
          {email && <InfoRow icon={Mail} value={email} href={`mailto:${email}`} />}
          {website && <InfoRow icon={Globe} value={website} href={website} external />}
          {hours && <InfoRow icon={Clock} value={hours} />}
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nom">
        <Input value={props.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea
          value={props.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="resize-y"
        />
      </Field>
      <Field label="Logo">
        <ImageUpload
          value={props.logo ?? ''}
          onChange={(url) => onChange({ logo: url })}
          compact
        />
      </Field>
      <Field label="Adresse">
        <Input
          value={props.address ?? ''}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </Field>
      <Field label="Téléphone">
        <Input value={props.phone ?? ''} onChange={(e) => onChange({ phone: e.target.value })} />
      </Field>
      <Field label="Email">
        <Input value={props.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} />
      </Field>
      <Field label="Site web">
        <Input
          value={props.website ?? ''}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </Field>
      <Field label="Horaires">
        <Input
          value={props.hours ?? ''}
          onChange={(e) => onChange({ hours: e.target.value })}
          placeholder="Lun-Ven 9h-17h"
        />
      </Field>
    </Group>
  ),
})
