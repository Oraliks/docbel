'use client'

/* eslint-disable @next/next/no-img-element */

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { ImageUpload } from '@/components/page-builder/inspector/image-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { articleHeaderSchema as schema } from './schemas'

export const articleHeader = defineBlock({
  type: 'articleHeader',
  schema,
  defaults: {
    category: 'Actualité',
    title: 'Titre de l\'article',
    excerpt: 'Sous-titre ou résumé.',
    authorName: 'Auteur',
    authorAvatar: '',
    date: new Date().toISOString(),
    readingTime: 5,
    image: '',
  },
  meta: {
    name: 'En-tête article',
    description: 'Titre + auteur + date + temps de lecture',
    category: 'editorial',
    icon: 'file-text',
    shortcuts: ['articleheader'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.article')
    const { category, title, excerpt, authorName, authorAvatar, date, readingTime, image } = props
    return (
      <header className="my-4">
        {category && (
          <p className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
            {category}
          </p>
        )}
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">{title}</h1>
        {excerpt && (
          <p className="mt-3 text-lg md:text-xl text-muted-foreground">{excerpt}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-y py-3">
          {authorAvatar && (
            <img
              src={authorAvatar}
              alt={authorName || ''}
              loading="lazy"
              decoding="async"
              className="size-9 rounded-full object-cover"
            />
          )}
          {authorName && <span className="font-medium text-foreground">{authorName}</span>}
          {date && (
            <>
              <span>·</span>
              <time>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(date))}
              </time>
            </>
          )}
          {readingTime !== undefined && (
            <>
              <span>·</span>
              <span>{t('readingTimeMin', { min: readingTime })}</span>
            </>
          )}
        </div>
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            className="mt-6 w-full aspect-video object-cover rounded-2xl"
          />
        )}
      </header>
    )
  },
  Fields: ({ props, onChange }) => {
    const t = useTranslations('public.article')
    return (
      <Group title={t('fieldGroupContent')} defaultOpen>
        <Field label={t('fieldCategory')}>
          <Input
            value={props.category ?? ''}
            onChange={(e) => onChange({ category: e.target.value })}
          />
        </Field>
        <Field label={t('fieldTitle')}>
          <Textarea
            value={props.title}
            onChange={(e) => onChange({ title: e.target.value })}
            rows={2}
            className="resize-y"
          />
        </Field>
        <Field label={t('fieldExcerpt')}>
          <Textarea
            value={props.excerpt ?? ''}
            onChange={(e) => onChange({ excerpt: e.target.value })}
            rows={2}
            className="resize-y"
          />
        </Field>
        <Field label={t('fieldAuthor')}>
          <Input
            value={props.authorName ?? ''}
            onChange={(e) => onChange({ authorName: e.target.value })}
          />
        </Field>
        <Field label={t('fieldAuthorAvatar')}>
          <ImageUpload
            value={props.authorAvatar ?? ''}
            onChange={(url) => onChange({ authorAvatar: url })}
            compact
          />
        </Field>
        <Field label={t('fieldDate')}>
          <Input
            type="date"
            value={props.date ? props.date.slice(0, 10) : ''}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </Field>
        <Field label={t('fieldReadingTime')}>
          <Input
            type="number"
            min={1}
            value={props.readingTime ?? 5}
            onChange={(e) => onChange({ readingTime: Number(e.target.value) })}
          />
        </Field>
        <Field label={t('fieldHeaderImage')}>
          <ImageUpload
            value={props.image ?? ''}
            onChange={(url) => onChange({ image: url })}
          />
        </Field>
      </Group>
    )
  },
})
