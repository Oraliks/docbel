'use client'

import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  X as CloseIcon,
} from 'lucide-react'
import type {
  CardProps,
  AccordionProps,
  TabsProps,
  AlertProps,
  BadgesProps,
  ProgressProps,
  ButtonGroupProps,
  ButtonGroupItem,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── Card ───────────────────────────

export function CardBlock({
  title,
  description,
  body,
  image,
  ctaText,
  ctaLink,
  variant = 'default',
}: CardProps) {
  const variantClass = {
    default: 'border bg-card',
    bordered: 'border-2 bg-card',
    elevated: 'border-0 bg-card shadow-lg',
    gradient: 'border-0 bg-gradient-to-br from-primary/10 via-background to-background',
  }[variant]

  return (
    <div className={cn('rounded-2xl overflow-hidden transition hover:-translate-y-0.5', variantClass)}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="w-full aspect-video object-cover" />
      )}
      <div className="p-6">
        {title && <h3 className="text-lg font-semibold tracking-tight">{title}</h3>}
        {description && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
        {body && (
          <div
            className="mt-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
        {ctaText && (
          <a
            href={ctaLink || '#'}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {ctaText}
            <ArrowRight className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Accordion ───────────────────────────

export function AccordionBlock({ items, type = 'single', variant = 'default' }: AccordionProps) {
  const wrapperClass = {
    default: '',
    bordered: 'rounded-2xl border bg-card overflow-hidden',
    separated: 'space-y-2',
  }[variant]

  return (
    <div className={cn('w-full', wrapperClass)}>
      <Accordion type={type} collapsible>
        {items.map((item, idx) => (
          <AccordionItem
            key={idx}
            value={`item-${idx}`}
            className={cn(
              variant === 'separated' && 'rounded-xl border bg-card px-4'
            )}
          >
            <AccordionTrigger className="px-4">{item.title}</AccordionTrigger>
            <AccordionContent className="px-4">{item.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

// ─────────────────────────── Tabs ───────────────────────────

export function TabsBlock({ items, variant = 'default' }: TabsProps) {
  const [active, setActive] = React.useState('0')

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
        Aucun onglet
      </div>
    )
  }

  if (variant === 'pills') {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(String(i))}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition',
                active === String(i)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="mt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
      </div>
    )
  }

  if (variant === 'underline') {
    return (
      <div>
        <div className="flex border-b">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(String(i))}
              className={cn(
                'border-b-2 px-4 py-2 -mb-px text-sm font-medium transition',
                active === String(i)
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div className="pt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
      </div>
    )
  }

  // default — segmented bar
  return (
    <div>
      <div className="inline-flex rounded-lg bg-muted p-1">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(String(i))}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium transition-all',
              active === String(i)
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
      <div className="pt-4 text-sm leading-relaxed">{items[Number(active)]?.content}</div>
    </div>
  )
}

// ─────────────────────────── Alert ───────────────────────────

const ALERT_STYLES: Record<NonNullable<AlertProps['variant']>, { class: string; icon: React.ElementType }> = {
  info: { class: 'border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900', icon: Info },
  success: { class: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900', icon: CheckCircle2 },
  warning: { class: 'border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900', icon: AlertTriangle },
  destructive: { class: 'border-red-200 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200 dark:border-red-900', icon: XCircle },
}

export function AlertBlock({ title, message, variant = 'info', dismissible }: AlertProps) {
  const [closed, setClosed] = React.useState(false)
  if (closed) return null
  const style = ALERT_STYLES[variant]
  const Icon = style.icon
  return (
    <div className={cn('relative flex gap-3 rounded-lg border px-4 py-3', style.class)}>
      <Icon className="size-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-sm">{title}</div>}
        <div className={cn('text-sm leading-relaxed', title && 'mt-0.5 opacity-90')}>{message}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="opacity-60 hover:opacity-100 transition shrink-0"
          aria-label="Fermer"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────── Badges ───────────────────────────

export function BadgesBlock({ title, items, align = 'left' }: BadgesProps) {
  return (
    <div className={cn('w-full', align === 'center' && 'text-center')}>
      {title && <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>}
      <div className={cn('flex flex-wrap gap-2', align === 'center' && 'justify-center')}>
        {items.map((b, i) =>
          b.color ? (
            <span
              key={i}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: b.color, color: 'white' }}
            >
              {b.label}
            </span>
          ) : (
            <Badge key={i} variant={b.variant ?? 'default'}>
              {b.label}
            </Badge>
          )
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Progress ───────────────────────────

export function ProgressBlock({
  label,
  value,
  showValue = true,
  color,
  variant = 'default',
}: ProgressProps) {
  const v = Math.max(0, Math.min(100, value))

  if (variant === 'circular') {
    const r = 36
    const circ = 2 * Math.PI * r
    const offset = circ - (v / 100) * circ
    return (
      <div className="flex items-center gap-4">
        <div className="relative size-20">
          <svg viewBox="0 0 80 80" className="size-20 -rotate-90">
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              stroke={color || 'var(--primary)'}
              strokeWidth="6"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
            {v}%
          </div>
        </div>
        {label && <div className="font-medium">{label}</div>}
      </div>
    )
  }

  if (variant === 'segmented') {
    const segments = 10
    const filled = Math.round((v / 100) * segments)
    return (
      <div>
        <div className="flex items-center justify-between mb-2 text-sm">
          {label && <span className="font-medium">{label}</span>}
          {showValue && <span className="text-muted-foreground">{v}%</span>}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded transition-colors"
              style={{
                backgroundColor: i < filled ? (color || 'var(--primary)') : 'var(--muted)',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // default
  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2 text-sm">
          {label && <span className="font-medium">{label}</span>}
          {showValue && <span className="text-muted-foreground">{v}%</span>}
        </div>
      )}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${v}%`, backgroundColor: color || 'var(--primary)' }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────── Button group ───────────────────────────

const BTN_GROUP_STYLE: Record<NonNullable<ButtonGroupItem['variant']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-foreground text-background hover:opacity-90',
  outline: 'border border-current bg-transparent hover:bg-foreground/5',
  ghost: 'bg-transparent hover:bg-foreground/5',
}
const BTN_GROUP_SIZE: Record<NonNullable<ButtonGroupProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function ButtonGroupBlock({ items, align = 'left', size = 'md' }: ButtonGroupProps) {
  const alignClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
  return (
    <div className={cn('flex flex-wrap gap-2', alignClass)}>
      {items.map((btn, i) => (
        <a
          key={i}
          href={btn.link || '#'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg font-medium transition',
            BTN_GROUP_STYLE[btn.variant ?? 'primary'],
            BTN_GROUP_SIZE[size]
          )}
        >
          {btn.text}
        </a>
      ))}
    </div>
  )
}
