'use client'

import React from 'react'
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Download,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Check,
  Loader2,
} from 'lucide-react'
import type {
  DocumentProps,
  StepsProps,
  OrganismeProps,
  GlossaryProps,
  CounterProps,
  CollectionProps,
  FormProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── Document ───────────────────────────

const DOC_ICONS: Record<NonNullable<DocumentProps['fileType']>, React.ElementType> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  image: FileImage,
  archive: FileArchive,
  other: FileIcon,
}

const DOC_COLORS: Record<NonNullable<DocumentProps['fileType']>, string> = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  xlsx: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  image: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  archive: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  other: 'bg-muted text-muted-foreground',
}

export function DocumentBlock({
  fileId,
  url,
  title,
  description,
  fileType = 'pdf',
  size,
  date,
  variant = 'card',
}: DocumentProps) {
  const Icon = DOC_ICONS[fileType]
  const iconColorClass = DOC_COLORS[fileType]
  const downloadUrl = fileId ? `/api/files/${fileId}/download` : url || '#'

  if (variant === 'inline') {
    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 transition"
      >
        <Icon className="size-4 text-primary" />
        <span className="font-medium">{title}</span>
        {size && <span className="text-xs text-muted-foreground">· {size}</span>}
        <Download className="size-3.5 text-muted-foreground ml-1" />
      </a>
    )
  }

  if (variant === 'list') {
    return (
      <a
        href={downloadUrl}
        target="_blank"
        rel="noreferrer"
        className="group/doc flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:border-primary hover:bg-primary/5 transition"
      >
        <div className={cn('flex size-9 items-center justify-center rounded-md shrink-0', iconColorClass)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{title}</div>
          {(size || date) && (
            <div className="text-xs text-muted-foreground">
              {[fileType.toUpperCase(), size, date].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <Download className="size-4 text-muted-foreground group-hover/doc:text-primary shrink-0" />
      </a>
    )
  }

  // card (default)
  return (
    <a
      href={downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="group/doc flex gap-4 rounded-2xl border bg-card p-5 hover:border-primary hover:shadow-md transition"
    >
      <div className={cn('flex size-12 items-center justify-center rounded-xl shrink-0', iconColorClass)}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="font-medium uppercase">{fileType}</span>
          {size && <span>{size}</span>}
          {date && <span>{date}</span>}
        </div>
      </div>
      <Download className="size-5 text-muted-foreground group-hover/doc:text-primary shrink-0 self-center" />
    </a>
  )
}

// ─────────────────────────── Steps ───────────────────────────

export function StepsBlock({
  title,
  subtitle,
  items,
  orientation = 'horizontal',
}: StepsProps) {
  return (
    <div className="w-full py-8">
      <div className="mx-auto max-w-5xl px-4">
        {(title || subtitle) && (
          <div className="mb-8 text-center max-w-2xl mx-auto">
            {title && <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          </div>
        )}

        {orientation === 'vertical' ? (
          <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-2">
            {items.map((step, idx) => (
              <li key={idx} className="relative">
                <span
                  className={cn(
                    'absolute -left-[34px] flex size-8 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-background',
                    step.status === 'done'
                      ? 'bg-primary text-primary-foreground'
                      : step.status === 'current'
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.status === 'done' ? <Check className="size-4" /> : step.icon || idx + 1}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
            {items.map((step, idx) => (
              <div key={idx} className="relative text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold mb-3">
                  {step.icon || idx + 1}
                </div>
                {idx < items.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-border" />
                )}
                <h3 className="font-semibold relative">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground relative">{step.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Organisme ───────────────────────────

export function OrganismeBlock({
  name,
  description,
  address,
  phone,
  email,
  website,
  hours,
  logo,
  variant = 'card',
}: OrganismeProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-14 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="size-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="size-6 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">{name}</h3>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
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
}

function InfoRow({
  icon: Icon,
  value,
  href,
  external,
}: {
  icon: React.ElementType
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
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="group hover:text-primary transition"
    >
      {content}
    </a>
  )
}

// ─────────────────────────── Glossary ───────────────────────────

export function GlossaryBlock({ title, items, variant = 'list' }: GlossaryProps) {
  if (variant === 'alphabetical') {
    const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
      const letter = (it.term[0] || '#').toUpperCase()
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(it)
      return acc
    }, {})
    const letters = Object.keys(grouped).sort()
    return (
      <div className="w-full py-6">
        <div className="mx-auto max-w-3xl px-4">
          {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
          {letters.map((l) => (
            <div key={l} className="mb-6">
              <h3 className="text-3xl font-bold text-primary mb-3">{l}</h3>
              <dl className="space-y-3">
                {grouped[l].map((item, i) => (
                  <div key={i} className="border-l-2 border-border pl-4">
                    <dt className="font-semibold">{item.term}</dt>
                    <dd className="text-sm text-muted-foreground mt-0.5">{item.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div className="w-full py-6">
        <div className="mx-auto max-w-5xl px-4">
          {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <dt className="font-semibold text-primary">{item.term}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{item.definition}</dd>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // list (default)
  return (
    <div className="w-full py-6">
      <div className="mx-auto max-w-3xl px-4">
        {title && <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>}
        <dl className="divide-y">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2 py-3">
              <dt className="font-semibold md:col-span-1">{item.term}</dt>
              <dd className="text-sm text-muted-foreground md:col-span-2">{item.definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

// ─────────────────────────── Counter (animated) ───────────────────────────

const COUNTER_COLS: Record<CounterProps['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 md:grid-cols-4',
}

function useInView(threshold = 0.3) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [inView, setInView] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function AnimatedNumber({ value, duration }: { value: number; duration: number }) {
  const { ref, inView } = useInView()
  const [display, setDisplay] = React.useState(0)

  React.useEffect(() => {
    if (!inView) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(value * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return <span ref={ref}>{display.toLocaleString('fr-FR')}</span>
}

export function CounterBlock({ title, items, columns, duration = 2000 }: CounterProps) {
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-7xl px-6">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            {title}
          </h2>
        )}
        <div className={cn('grid grid-cols-1 gap-6', COUNTER_COLS[columns])}>
          {items.map((item, idx) => (
            <div key={idx} className="text-center">
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                {item.prefix}
                <AnimatedNumber value={item.value} duration={duration} />
                {item.suffix}
              </div>
              <div className="mt-2 text-sm text-muted-foreground uppercase tracking-wider">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Collection (dynamic) ───────────────────────────

interface NewsItem {
  id: string
  title: string
  slug: string
  excerpt?: string
  image?: string
  category?: string
  publishedAt?: string
}

export function CollectionBlock({
  source,
  limit,
  category,
  layout,
  columns = 3,
}: CollectionProps) {
  const [items, setItems] = React.useState<NewsItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    params.set('status', 'published')
    if (category) params.set('category', category)
    fetch(`/api/${source}?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const rows = Array.isArray(data) ? data : data.items || []
        setItems(rows.slice(0, limit))
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setItems([])
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [source, limit, category])

  if (loading) {
    return (
      <div className="w-full py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="w-full py-12 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
        Aucun élément à afficher
      </div>
    )
  }

  const colsClass: Record<NonNullable<CollectionProps['columns']>, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }

  if (layout === 'list') {
    return (
      <div className="w-full py-8">
        <div className="space-y-3 mx-auto max-w-3xl px-4">
          {items.map((item) => (
            <a
              key={item.id}
              href={source === 'news' ? `/actualites/${item.slug}` : `/${item.slug}`}
              className="block rounded-xl border bg-card p-4 hover:border-primary hover:shadow-sm transition"
            >
              <div className="font-semibold">{item.title}</div>
              {item.excerpt && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.excerpt}</p>
              )}
            </a>
          ))}
        </div>
      </div>
    )
  }

  // grid (default)
  return (
    <div className="w-full py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className={cn('grid grid-cols-1 gap-6', colsClass[columns])}>
          {items.map((item) => (
            <a
              key={item.id}
              href={source === 'news' ? `/actualites/${item.slug}` : `/${item.slug}`}
              className="group/coll rounded-2xl border bg-card overflow-hidden hover:shadow-md transition"
            >
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="w-full aspect-video object-cover group-hover/coll:scale-105 transition-transform"
                />
              )}
              <div className="p-5">
                {item.category && (
                  <div className="text-xs font-medium uppercase tracking-wider text-primary">
                    {item.category}
                  </div>
                )}
                <h3 className="mt-1 font-semibold leading-tight">{item.title}</h3>
                {item.excerpt && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{item.excerpt}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Form ───────────────────────────

export function FormBlock({
  title,
  description,
  fields,
  submitText,
  successMessage = 'Message envoyé.',
  endpoint = '/api/messages',
}: FormProps) {
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const payload: Record<string, unknown> = {}
    formData.forEach((value, key) => {
      payload[key] = value
    })
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Erreur')
      } else {
        setSuccess(true)
        ;(e.currentTarget as HTMLFormElement).reset()
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 md:p-8">
      {title && <h3 className="text-xl font-bold tracking-tight">{title}</h3>}
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}

      {success ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900 flex items-center gap-2">
          <Check className="size-4" />
          {successMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {fields.map((field, i) => (
            <div key={i} className="space-y-1.5">
              <label className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  rows={4}
                  className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  required={field.required}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="">{field.placeholder || 'Choisir…'}</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name={field.name}
                    required={field.required}
                    className="size-4 rounded border-input"
                  />
                  <span className="text-sm">{field.placeholder || field.label}</span>
                </div>
              ) : (
                <input
                  type={field.type}
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitText}
          </button>
        </form>
      )}
    </div>
  )
}
