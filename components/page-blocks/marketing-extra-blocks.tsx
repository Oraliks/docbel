'use client'

import React from 'react'
import { Check, X as XIcon, Star, Loader2 } from 'lucide-react'
import type {
  PricingTableProps,
  CompareTableProps,
  CountdownProps,
  NotificationBarProps,
  NewsletterProps,
  TrustBadgesProps,
  PressMentionsProps,
  StarRatingProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { renderIcon } from '@/components/page-builder/inspector/icon-picker'
import { toast } from 'sonner'

// ─────────────────────────── Pricing Table ───────────────────────────

export function PricingTableBlock({
  title,
  subtitle,
  plans,
  togglePeriod,
}: PricingTableProps) {
  const [yearly, setYearly] = React.useState(false)
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-7xl px-6">
        {(title || subtitle) && (
          <div className="text-center mb-10 max-w-2xl mx-auto">
            {title && <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {togglePeriod && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-full bg-muted p-1">
              <button
                type="button"
                onClick={() => setYearly(false)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  !yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setYearly(true)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Annuel <span className="text-emerald-600">-20%</span>
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={cn(
                'rounded-2xl border bg-card p-6 flex flex-col relative',
                plan.highlighted && 'border-primary border-2 shadow-lg md:scale-105'
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-medium">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              {plan.description && (
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              )}
              <div className="mt-4">
                <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>
                )}
              </div>
              <ul className="mt-6 space-y-2 text-sm flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <Check className="size-4 mt-0.5 text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.ctaLink || '#'}
                className={cn(
                  'mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition',
                  plan.highlighted
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'border border-current bg-transparent hover:bg-muted'
                )}
              >
                {plan.ctaText}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Compare Table ───────────────────────────

export function CompareTableBlock({
  title,
  columns,
  rows,
  highlightColumn,
}: CompareTableProps) {
  return (
    <div className="w-full py-8 overflow-x-auto">
      <div className="mx-auto max-w-5xl px-6">
        {title && <h3 className="text-2xl font-bold tracking-tight text-center mb-6">{title}</h3>}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-3 font-medium text-sm text-muted-foreground" />
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    'text-center p-3 font-semibold',
                    highlightColumn === i && 'bg-primary/10 text-primary rounded-t-lg'
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t">
                <td className="p-3 text-sm font-medium">{row.feature}</td>
                {row.values.map((v, vi) => (
                  <td
                    key={vi}
                    className={cn(
                      'text-center p-3',
                      highlightColumn === vi && 'bg-primary/5'
                    )}
                  >
                    {typeof v === 'boolean' ? (
                      v ? (
                        <Check className="size-4 mx-auto text-emerald-600" />
                      ) : (
                        <XIcon className="size-4 mx-auto text-muted-foreground/50" />
                      )
                    ) : (
                      <span className="text-sm">{v}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────── Countdown ───────────────────────────

export function CountdownBlock({
  targetDate,
  title,
  variant = 'large',
  expiredMessage = 'Terminé !',
}: CountdownProps) {
  const [now, setNow] = React.useState<number>(() => Date.now())
  React.useEffect(() => {
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
      {title && <p className="text-sm uppercase tracking-wider text-muted-foreground mb-3">{title}</p>}
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
}

// ─────────────────────────── Notification Bar ───────────────────────────

const NOTIF_STYLES: Record<NonNullable<NotificationBarProps['variant']>, string> = {
  info: 'bg-blue-500 text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-amber-500 text-amber-950',
  destructive: 'bg-red-500 text-white',
}

export function NotificationBarBlock({
  message,
  ctaText,
  ctaLink,
  variant = 'info',
  dismissible,
}: NotificationBarProps) {
  const [closed, setClosed] = React.useState(false)
  if (closed) return null
  return (
    <div className={cn('w-full py-2 px-4 my-2 rounded-lg flex items-center justify-center gap-3 text-sm', NOTIF_STYLES[variant])}>
      <span>{message}</span>
      {ctaText && (
        <a href={ctaLink || '#'} className="underline font-medium hover:opacity-90">
          {ctaText}
        </a>
      )}
      {dismissible && (
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="ml-2 opacity-70 hover:opacity-100"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────── Newsletter (inline) ───────────────────────────

export function NewsletterBlock({
  title,
  description,
  placeholder = 'votre@email.com',
  buttonText,
  endpoint,
  successMessage = 'Merci, vous êtes inscrit !',
}: NewsletterProps) {
  const [email, setEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitting(true)
    try {
      if (endpoint) {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      }
      setSuccess(true)
      toast.success(successMessage)
    } catch {
      toast.error('Erreur — réessayez')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 my-2">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {success ? (
        <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium">
          <Check className="size-4" />
          {successMessage}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {buttonText}
          </button>
        </form>
      )}
    </div>
  )
}

// ─────────────────────────── Trust Badges ───────────────────────────

export function TrustBadgesBlock({ badges, align = 'center' }: TrustBadgesProps) {
  return (
    <div className={cn('w-full py-4 flex flex-wrap gap-x-6 gap-y-3', align === 'center' && 'justify-center')}>
      {badges.map((b, i) => (
        <div key={i} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {b.icon && <span className="text-primary">{renderIcon(b.icon, 'size-4')}</span>}
          {b.label}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────── Press Mentions ───────────────────────────

export function PressMentionsBlock({ title, logos }: PressMentionsProps) {
  return (
    <div className="w-full py-6">
      <div className="mx-auto max-w-7xl px-6">
        {title && (
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
          {logos.map((logo, i) =>
            logo.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={logo.url} alt={logo.alt} className="h-7 object-contain" />
            ) : (
              <span key={i} className="text-base font-serif italic">
                {logo.alt}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Star Rating ───────────────────────────

const RATING_SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' } as const

export function StarRatingBlock({ value, count, showCount = true, size = 'md' }: StarRatingProps) {
  const v = Math.max(0, Math.min(5, value))
  const full = Math.floor(v)
  const fractional = v - full
  const cls = RATING_SIZES[size]
  return (
    <div className="inline-flex items-center gap-2 my-1">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn('relative', cls)}>
            <Star className={cn(cls, 'text-muted-foreground/30')} />
            {i < full && (
              <Star
                className={cn(cls, 'absolute inset-0 text-amber-400 fill-amber-400')}
              />
            )}
            {i === full && fractional > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fractional * 100}%` }}
              >
                <Star className={cn(cls, 'text-amber-400 fill-amber-400')} />
              </div>
            )}
          </div>
        ))}
      </div>
      <span className="text-sm font-medium tabular-nums">{v.toFixed(1)}</span>
      {showCount && count !== undefined && (
        <span className="text-xs text-muted-foreground">({count.toLocaleString('fr-FR')})</span>
      )}
    </div>
  )
}
