'use client'

import React from 'react'
import { Clock, ChevronUp } from 'lucide-react'
import type {
  OpeningHoursProps,
  LastUpdatedProps,
  TableOfContentsProps,
  AnchorMenuProps,
  BackToTopProps,
  ReadingProgressProps,
  ArticleHeaderProps,
  AuthorBioProps,
  SponsoredDisclosureProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── Opening Hours ───────────────────────────

const DAY_LABEL: Record<OpeningHoursProps['schedule'][number]['day'], string> = {
  mon: 'Lundi',
  tue: 'Mardi',
  wed: 'Mercredi',
  thu: 'Jeudi',
  fri: 'Vendredi',
  sat: 'Samedi',
  sun: 'Dimanche',
}

export function OpeningHoursBlock({ title, schedule, showCurrentStatus }: OpeningHoursProps) {
  const today = new Date()
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const todayKey = dayKeys[today.getDay()]
  const todayEntry = schedule.find((s) => s.day === todayKey)

  let openNow = false
  if (todayEntry && !todayEntry.closed && todayEntry.open && todayEntry.close) {
    const [oh, om] = todayEntry.open.split(':').map(Number)
    const [ch, cm] = todayEntry.close.split(':').map(Number)
    const now = today.getHours() * 60 + today.getMinutes()
    openNow = now >= oh * 60 + om && now < ch * 60 + cm
  }

  return (
    <div className="rounded-2xl border bg-card p-5 my-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h3 className="font-semibold">{title || 'Horaires'}</h3>
        </div>
        {showCurrentStatus && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              openNow
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/15 text-red-700 dark:text-red-300'
            )}
          >
            {openNow ? '● Ouvert' : '● Fermé'}
          </span>
        )}
      </div>
      <dl className="space-y-1.5">
        {schedule.map((s) => (
          <div
            key={s.day}
            className={cn(
              'grid grid-cols-2 gap-2 text-sm rounded px-2 py-1',
              s.day === todayKey && 'bg-primary/5 font-medium'
            )}
          >
            <dt>{DAY_LABEL[s.day]}</dt>
            <dd className="text-right tabular-nums">
              {s.closed ? (
                <span className="text-muted-foreground">Fermé</span>
              ) : (
                `${s.open} – ${s.close}`
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─────────────────────────── Last Updated ───────────────────────────

export function LastUpdatedBlock({ date, format = 'long', prefix = 'Mis à jour' }: LastUpdatedProps) {
  if (!date) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {prefix} : (date de mise à jour de la page)
      </p>
    )
  }
  return <LastUpdatedInner date={date} format={format} prefix={prefix} />
}

function LastUpdatedInner({ date, format, prefix }: { date: string; format: NonNullable<LastUpdatedProps['format']>; prefix: string }) {
  const [now, setNow] = React.useState<number | null>(null)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      else if (days < 30) formatted = `il y a ${Math.floor(days / 7)} semaine${days >= 14 ? 's' : ''}`
      else formatted = `il y a ${Math.floor(days / 30)} mois`
    }
  }
  return (
    <p className="text-xs text-muted-foreground my-1">
      {prefix} {formatted}
    </p>
  )
}

// ─────────────────────────── Table of Contents ───────────────────────────

interface TocItem {
  level: number
  text: string
  id: string
}

export function TableOfContentsBlock({ title = 'Sommaire', sticky, maxLevel = 3 }: TableOfContentsProps) {
  const [items, setItems] = React.useState<TocItem[]>([])

  React.useEffect(() => {
    // Find the closest scope (page-content) and extract headings
    const scope = document.querySelector('.page-content') ?? document.body
    const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(',')
    const list: TocItem[] = []
    scope.querySelectorAll(selector).forEach((el, idx) => {
      const tag = el.tagName.toLowerCase()
      const level = Number(tag.replace('h', ''))
      const text = el.textContent ?? ''
      if (!text.trim()) return
      let id = el.id
      if (!id) {
        id = text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) + '-' + idx
        el.id = id
      }
      list.push({ level, text, id })
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(list)
  }, [maxLevel])

  return (
    <nav
      className={cn(
        'rounded-2xl border bg-card p-4 my-2',
        sticky && 'sticky top-4'
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">(Aucun titre détecté)</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i}>
              <a
                href={`#${item.id}`}
                className="block hover:text-primary transition"
                style={{ paddingLeft: (item.level - 1) * 12 }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}

// ─────────────────────────── Anchor Menu ───────────────────────────

export function AnchorMenuBlock({ items, sticky }: AnchorMenuProps) {
  return (
    <nav
      className={cn(
        'flex flex-wrap gap-2 rounded-2xl border bg-card/80 backdrop-blur p-2 my-2',
        sticky && 'sticky top-4 z-20'
      )}
    >
      {items.map((item, i) => (
        <a
          key={i}
          href={`#${item.anchor}`}
          className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}

// ─────────────────────────── Back to Top ───────────────────────────

export function BackToTopBlock({ threshold = 400 }: BackToTopProps) {
  const [show, setShow] = React.useState(false)
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  if (!show) return null
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform"
      title="Remonter en haut"
    >
      <ChevronUp className="size-5" />
    </button>
  )
}

// ─────────────────────────── Reading Progress ───────────────────────────

export function ReadingProgressBlock({ color = '#C8102E', height = 3 }: ReadingProgressProps) {
  const [pct, setPct] = React.useState(0)
  React.useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      if (total <= 0) {
        setPct(0)
        return
      }
      setPct(Math.min(100, (window.scrollY / total) * 100))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div
      className="fixed top-0 inset-x-0 z-50 pointer-events-none"
      style={{ height }}
    >
      <div
        className="h-full transition-[width] ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─────────────────────────── Article Header ───────────────────────────

export function ArticleHeaderBlock({
  category,
  title,
  excerpt,
  authorName,
  authorAvatar,
  date,
  readingTime,
  image,
}: ArticleHeaderProps) {
  return (
    <header className="my-4">
      {category && (
        <p className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
          {category}
        </p>
      )}
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">{title}</h1>
      {excerpt && <p className="mt-3 text-lg md:text-xl text-muted-foreground">{excerpt}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-y py-3">
        {authorAvatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={authorAvatar}
            alt={authorName || ''}
            className="size-9 rounded-full object-cover"
          />
        )}
        {authorName && <span className="font-medium text-foreground">{authorName}</span>}
        {date && (
          <>
            <span>·</span>
            <time>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(date))}</time>
          </>
        )}
        {readingTime !== undefined && (
          <>
            <span>·</span>
            <span>{readingTime} min de lecture</span>
          </>
        )}
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="mt-6 w-full aspect-video object-cover rounded-2xl"
        />
      )}
    </header>
  )
}

// ─────────────────────────── Author Bio ───────────────────────────

export function AuthorBioBlock({
  name,
  bio,
  avatar,
  twitter,
  linkedin,
  website,
  email,
}: AuthorBioProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 my-2 flex gap-4">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="size-14 rounded-full object-cover shrink-0" />
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
            <a href={twitter} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Twitter
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              LinkedIn
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
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
}

// ─────────────────────────── Sponsored Disclosure ───────────────────────────

export function SponsoredDisclosureBlock({ sponsor }: SponsoredDisclosureProps) {
  return (
    <div className="rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 my-2">
      <span className="font-semibold uppercase tracking-wider">Contenu sponsorisé</span>
      {sponsor && <span className="ml-2">— en partenariat avec {sponsor}</span>}
    </div>
  )
}
