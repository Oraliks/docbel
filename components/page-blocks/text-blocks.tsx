'use client'

import React from 'react'
import type {
  HeadingProps,
  TextProps,
  QuoteProps,
  DividerProps,
  SpacerProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────────── Heading ───────────────────────────────

export function HeadingBlock({
  text,
  level,
  variant = 'default',
}: HeadingProps) {
  const Tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements
  const sizes = {
    1: 'text-4xl md:text-5xl lg:text-6xl',
    2: 'text-3xl md:text-4xl',
    3: 'text-2xl md:text-3xl',
    4: 'text-xl md:text-2xl',
    5: 'text-lg md:text-xl',
    6: 'text-base md:text-lg',
  } as const

  const variantClass = {
    default: 'font-bold tracking-tight',
    display: 'font-extrabold tracking-tighter',
    gradient:
      'font-extrabold tracking-tighter bg-gradient-to-br from-primary to-foreground bg-clip-text text-transparent',
  }[variant]

  return (
    <Tag className={cn(sizes[level], variantClass, 'leading-[1.1]')}>{text}</Tag>
  )
}

// ─────────────────────────────── Text ───────────────────────────────

export function TextBlock({ html, variant = 'default' }: TextProps) {
  const variantClass = {
    default: 'text-base leading-relaxed',
    lead: 'text-lg md:text-xl leading-relaxed text-foreground/80',
    small: 'text-sm leading-relaxed text-muted-foreground',
  }[variant]

  return (
    <div
      className={cn('prose-tight max-w-none', variantClass)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─────────────────────────────── Quote ───────────────────────────────

export function QuoteBlock({
  text,
  author,
  role,
  variant = 'simple',
}: QuoteProps) {
  if (variant === 'pull') {
    return (
      <blockquote className="border-l-4 border-primary pl-6 py-2 my-4">
        <p className="text-2xl md:text-3xl font-medium leading-snug">“{text}”</p>
        {(author || role) && (
          <footer className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{author}</span>
            {role && <span>, {role}</span>}
          </footer>
        )}
      </blockquote>
    )
  }

  if (variant === 'card') {
    return (
      <blockquote className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
        <p className="text-lg md:text-xl leading-relaxed">“{text}”</p>
        {(author || role) && (
          <footer className="mt-4 text-sm">
            <span className="font-semibold text-foreground">{author}</span>
            {role && <span className="text-muted-foreground">, {role}</span>}
          </footer>
        )}
      </blockquote>
    )
  }

  return (
    <blockquote className="border-l-2 border-primary pl-4 italic">
      <p className="text-base md:text-lg leading-relaxed">“{text}”</p>
      {(author || role) && (
        <footer className="mt-2 text-sm text-muted-foreground not-italic">
          {author}
          {role && `, ${role}`}
        </footer>
      )}
    </blockquote>
  )
}

// ─────────────────────────────── Divider ───────────────────────────────

export function DividerBlock({ variant = 'solid', thickness = 1 }: DividerProps) {
  if (variant === 'gradient') {
    return (
      <hr
        className="border-0 my-2 bg-gradient-to-r from-transparent via-border to-transparent"
        style={{ height: thickness }}
      />
    )
  }
  return (
    <hr
      className="my-2"
      style={{
        borderTopStyle: variant,
        borderTopWidth: thickness,
        borderColor: 'var(--border)',
      }}
    />
  )
}

// ─────────────────────────────── Spacer ───────────────────────────────

export function SpacerBlock({ height }: SpacerProps) {
  return <div aria-hidden style={{ height }} />
}
