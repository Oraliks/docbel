'use client'

import React from 'react'
import type {
  HeroProps,
  FeaturesProps,
  CtaProps,
  FaqProps,
  TestimonialProps,
  StatsProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { ChevronDown, Quote as QuoteIcon, ArrowRight } from 'lucide-react'
import { renderIcon } from '@/components/page-builder/inspector/icon-picker'

// ═════════════════════════════════ HERO ═════════════════════════════════

export function HeroBlock({
  title,
  subtitle,
  description,
  ctaText,
  ctaLink,
  ctaSecondaryText,
  ctaSecondaryLink,
  image,
  bgColor,
  variant = 'centered',
}: HeroProps) {
  const isDark = bgColor && /^#(0|1|2|3|4)/.test(bgColor)

  if (variant === 'split') {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: bgColor || '#111318', color: isDark ? '#fff' : undefined }}
      >
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            {subtitle && (
              <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-70">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-6 text-lg opacity-80 max-w-xl">{description}</p>
            )}
            <HeroCtas
              ctaText={ctaText}
              ctaLink={ctaLink}
              secondText={ctaSecondaryText}
              secondLink={ctaSecondaryLink}
            />
          </div>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="w-full rounded-2xl object-cover aspect-[4/3] md:aspect-square"
            />
          ) : (
            <div className="aspect-[4/3] md:aspect-square rounded-2xl bg-white/10 border border-white/10" />
          )}
        </div>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className="w-full py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-4 text-base md:text-lg text-muted-foreground">{description}</p>
          )}
          <HeroCtas
            ctaText={ctaText}
            ctaLink={ctaLink}
            secondText={ctaSecondaryText}
            secondLink={ctaSecondaryLink}
          />
        </div>
      </div>
    )
  }

  if (variant === 'fullbleed') {
    return (
      <div
        className="relative w-full min-h-[60vh] md:min-h-[70vh] flex items-center"
        style={{
          backgroundColor: bgColor || '#111318',
          backgroundImage: image ? `url(${image})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#fff',
        }}
      >
        {image && <div className="absolute inset-0 bg-black/40" aria-hidden />}
        <div className="relative mx-auto max-w-7xl px-6 py-20 w-full">
          <div className="max-w-3xl">
            {subtitle && (
              <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-80">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
              {title}
            </h1>
            {description && <p className="mt-6 text-lg md:text-xl opacity-90">{description}</p>}
            <HeroCtas
              ctaText={ctaText}
              ctaLink={ctaLink}
              secondText={ctaSecondaryText}
              secondLink={ctaSecondaryLink}
            />
          </div>
        </div>
      </div>
    )
  }

  // centered (default)
  return (
    <div
      className="relative w-full"
      style={{ backgroundColor: bgColor || 'transparent', color: isDark ? '#fff' : undefined }}
    >
      <div className="mx-auto max-w-4xl px-6 py-16 md:py-24 text-center">
        {subtitle && (
          <p className="mb-3 text-sm font-medium uppercase tracking-wider opacity-70">
            {subtitle}
          </p>
        )}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
          {title}
        </h1>
        {description && (
          <p className="mt-6 text-lg md:text-xl opacity-80 max-w-2xl mx-auto">
            {description}
          </p>
        )}
        <HeroCtas
          ctaText={ctaText}
          ctaLink={ctaLink}
          secondText={ctaSecondaryText}
          secondLink={ctaSecondaryLink}
          align="center"
        />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="mt-12 w-full rounded-2xl shadow-2xl"
          />
        )}
      </div>
    </div>
  )
}

function HeroCtas({
  ctaText,
  ctaLink,
  secondText,
  secondLink,
  align = 'left',
}: {
  ctaText?: string
  ctaLink?: string
  secondText?: string
  secondLink?: string
  align?: 'left' | 'center'
}) {
  if (!ctaText && !secondText) return null
  return (
    <div
      className={cn(
        'mt-8 flex flex-wrap items-center gap-3',
        align === 'center' && 'justify-center'
      )}
    >
      {ctaText && (
        <a
          href={ctaLink || '#'}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-3 text-sm font-medium hover:opacity-90 transition"
        >
          {ctaText}
          <ArrowRight className="size-4" />
        </a>
      )}
      {secondText && (
        <a
          href={secondLink || '#'}
          className="inline-flex items-center gap-2 rounded-lg border border-current/20 px-5 py-3 text-sm font-medium hover:bg-current/5 transition"
        >
          {secondText}
        </a>
      )}
    </div>
  )
}

// ═════════════════════════════════ FEATURES ═════════════════════════════════

const FEAT_COLS: Record<FeaturesProps['columns'], string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export function FeaturesBlock({
  title,
  subtitle,
  items,
  columns,
  variant = 'cards',
}: FeaturesProps) {
  return (
    <div className="w-full py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-6">
        {(title || subtitle) && (
          <header className="mb-10 text-center max-w-2xl mx-auto">
            {title && <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
          </header>
        )}

        <div className={cn('grid grid-cols-1 gap-6', FEAT_COLS[columns])}>
          {items.map((item, idx) => {
            if (variant === 'icons') {
              return (
                <div key={idx} className="flex gap-4">
                  {item.icon && (
                    <div className="shrink-0 leading-none text-primary">
                      {renderIcon(item.icon, 'size-7')}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              )
            }
            if (variant === 'centered') {
              return (
                <div key={idx} className="text-center">
                  {item.icon && (
                    <div className="mb-3 inline-flex items-center justify-center text-primary">
                      {renderIcon(item.icon, 'size-8')}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              )
            }
            // cards (default)
            return (
              <div
                key={idx}
                className="rounded-2xl border bg-card p-6 transition hover:shadow-md hover:-translate-y-0.5"
              >
                {item.icon && (
                  <div className="mb-3 leading-none text-primary">
                    {renderIcon(item.icon, 'size-7')}
                  </div>
                )}
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════ CTA ═════════════════════════════════

const BTN_SIZE: Record<NonNullable<CtaProps['buttonSize']>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const BTN_STYLE: Record<NonNullable<CtaProps['buttonStyle']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-foreground text-background hover:opacity-90',
  outline: 'border border-current bg-transparent hover:bg-foreground/5',
  ghost: 'bg-transparent hover:bg-foreground/5',
}

export function CtaBlock({
  title,
  description,
  text,
  link,
  secondaryText,
  secondaryLink,
  variant = 'banner',
  buttonStyle = 'primary',
  buttonSize = 'md',
}: CtaProps) {
  const buttonClass = cn(
    'inline-flex items-center gap-2 rounded-lg font-medium transition',
    BTN_SIZE[buttonSize],
    BTN_STYLE[buttonStyle]
  )

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <a href={link || '#'} className={buttonClass}>
          {text} <ArrowRight className="size-4" />
        </a>
        {secondaryText && (
          <a href={secondaryLink || '#'} className="text-sm font-medium hover:underline">
            {secondaryText}
          </a>
        )}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        {title && <h3 className="text-2xl font-bold tracking-tight">{title}</h3>}
        {description && <p className="mt-2 text-muted-foreground max-w-md mx-auto">{description}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href={link || '#'} className={buttonClass}>
            {text} <ArrowRight className="size-4" />
          </a>
          {secondaryText && (
            <a href={secondaryLink || '#'} className="text-sm font-medium hover:underline">
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    )
  }

  // banner (default)
  return (
    <div className="rounded-2xl bg-primary text-primary-foreground p-8 md:p-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-2xl">
          {title && <h3 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h3>}
          {description && <p className="mt-2 opacity-90">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href={link || '#'}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg font-medium transition bg-primary-foreground text-primary hover:opacity-90',
              BTN_SIZE[buttonSize]
            )}
          >
            {text} <ArrowRight className="size-4" />
          </a>
          {secondaryText && (
            <a
              href={secondaryLink || '#'}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════ FAQ ═════════════════════════════════

export function FaqBlock({ title, items, variant = 'simple' }: FaqProps) {
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-3xl px-6">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            {title}
          </h2>
        )}
        <div
          className={cn(
            'space-y-2',
            variant === 'card' && 'rounded-2xl border bg-card p-2 shadow-sm space-y-0'
          )}
        >
          {items.map((item, idx) => (
            <FaqItem
              key={idx}
              question={item.question}
              answer={item.answer}
              variant={variant}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function FaqItem({
  question,
  answer,
  variant,
}: {
  question: string
  answer: string
  variant: NonNullable<FaqProps['variant']>
}) {
  const [open, setOpen] = React.useState(false)

  const wrapper =
    variant === 'bordered'
      ? 'rounded-lg border bg-card'
      : variant === 'card'
        ? 'border-b last:border-b-0'
        : 'border-b last:border-b-0'

  return (
    <div className={wrapper}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-4 px-4 text-left hover:bg-muted/40 transition rounded-md"
      >
        <span className="font-medium">{question}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed animate-in fade-in-0 slide-in-from-top-1 duration-150">
          {answer}
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════ TESTIMONIAL ═════════════════════════════════

export function TestimonialBlock({
  title,
  items,
  variant = 'single',
}: TestimonialProps) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Aucun témoignage
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className="w-full py-12">
        <div className="mx-auto max-w-7xl px-6">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
              {title}
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((t, idx) => (
              <TestimonialCard key={idx} {...t} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // single or carousel (carousel falls back to single for now)
  const t = items[0]
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <QuoteIcon className="size-8 mx-auto text-primary opacity-60 mb-4" />
        <blockquote className="text-2xl md:text-3xl font-medium leading-snug">
          “{t.quote}”
        </blockquote>
        <div className="mt-6 flex items-center justify-center gap-3">
          {t.avatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatar} alt="" className="size-12 rounded-full object-cover" />
          )}
          <div className="text-left">
            <div className="font-semibold">{t.author}</div>
            {t.role && <div className="text-sm text-muted-foreground">{t.role}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TestimonialCard({
  quote,
  author,
  role,
  avatar,
}: TestimonialProps['items'][number]) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <QuoteIcon className="size-5 text-primary opacity-60 mb-3" />
      <p className="text-sm leading-relaxed">“{quote}”</p>
      <div className="mt-4 flex items-center gap-3">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="size-10 rounded-full bg-muted" />
        )}
        <div>
          <div className="font-semibold text-sm">{author}</div>
          {role && <div className="text-xs text-muted-foreground">{role}</div>}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════ STATS ═════════════════════════════════

const STATS_COLS: Record<StatsProps['columns'], string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export function StatsBlock({ title, items, columns, variant = 'simple' }: StatsProps) {
  return (
    <div className="w-full py-12">
      <div className="mx-auto max-w-7xl px-6">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-10">
            {title}
          </h2>
        )}
        <div className={cn('grid grid-cols-1 gap-6', STATS_COLS[columns])}>
          {items.map((s, idx) => {
            if (variant === 'cards') {
              return (
                <div
                  key={idx}
                  className="rounded-2xl border bg-card p-6 text-center shadow-sm"
                >
                  <div className="text-4xl md:text-5xl font-bold tracking-tight text-primary">
                    {s.prefix}
                    {s.value}
                    {s.suffix}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{s.label}</div>
                </div>
              )
            }
            return (
              <div key={idx} className="text-center">
                <div className="text-4xl md:text-5xl font-bold tracking-tight">
                  {s.prefix}
                  {s.value}
                  {s.suffix}
                </div>
                <div className="mt-1 text-sm text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
