'use client'

/* eslint-disable @next/next/no-img-element */

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { safeHref } from '@/lib/page-builder/url-utils'
import { authorBioSchema as schema } from './schemas'

export const authorBio = defineBlock({
  type: 'authorBio',
  schema,
  defaults: {
    name: 'Nom de l\'auteur',
    bio: 'Une courte biographie.',
    avatar: '',
    twitter: '',
    linkedin: '',
    website: '',
  },
  meta: {
    name: 'Bio auteur',
    description: 'Carte de présentation auteur',
    category: 'editorial',
    icon: 'user',
    shortcuts: ['author', 'bio'],
  },
  Render: ({ props }) => {
    const { name, bio, avatar, twitter, linkedin, website, email } = props
    return (
      <div className="rounded-2xl border bg-card p-5 my-2 flex gap-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="size-14 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
            {name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{name}</h3>
          {bio && <p className="mt-1 text-sm text-muted-foreground">{bio}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {twitter && (
              <a
                href={safeHref(twitter)}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Twitter
              </a>
            )}
            {linkedin && (
              <a
                href={safeHref(linkedin)}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                LinkedIn
              </a>
            )}
            {website && (
              <a
                href={safeHref(website)}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Site web
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="text-primary hover:underline">
                {email}
              </a>
            )}
          </div>
        </div>
      </div>
    )
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Nom">
        <Input value={props.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Bio">
        <Textarea
          value={props.bio ?? ''}
          onChange={(e) => onChange({ bio: e.target.value })}
          rows={3}
          className="resize-y"
        />
      </Field>
      <Field label="Avatar">
        <ImageUpload
          value={props.avatar ?? ''}
          onChange={(url) => onChange({ avatar: url })}
          compact
        />
      </Field>
      <Field label="Twitter">
        <Input
          value={props.twitter ?? ''}
          onChange={(e) => onChange({ twitter: e.target.value })}
        />
      </Field>
      <Field label="LinkedIn">
        <Input
          value={props.linkedin ?? ''}
          onChange={(e) => onChange({ linkedin: e.target.value })}
        />
      </Field>
      <Field label="Site web">
        <Input
          value={props.website ?? ''}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </Field>
      <Field label="Email">
        <Input
          value={props.email ?? ''}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </Field>
    </Group>
  ),
})
