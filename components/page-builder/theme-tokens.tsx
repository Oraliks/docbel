'use client'

import React from 'react'
import type { ThemeTokens } from '@/lib/page-builder/types'

/**
 * Apply per-page theme tokens by injecting CSS variable overrides into the
 * page tree. Children inherit them via the cascading custom properties.
 */
export function ThemeProvider({
  tokens,
  children,
}: {
  tokens?: ThemeTokens | null
  children: React.ReactNode
}) {
  const style: Record<string, string> = {}
  if (!tokens) return <>{children}</>
  if (tokens.primary) style['--primary'] = tokens.primary
  if (tokens.secondary) style['--secondary'] = tokens.secondary
  if (tokens.accent) style['--accent'] = tokens.accent
  if (tokens.background) style['--background'] = tokens.background
  if (tokens.foreground) style['--foreground'] = tokens.foreground
  if (tokens.muted) style['--muted'] = tokens.muted
  if (tokens.border) style['--border'] = tokens.border
  if (tokens.fontFamily) style.fontFamily = tokens.fontFamily
  if (tokens.radius !== undefined) style['--radius'] = `${tokens.radius}px`
  return (
    <div style={style as React.CSSProperties} className="page-theme-scope">
      {children}
    </div>
  )
}

/** Pre-built theme presets that can be applied with a click. */
export const THEME_PRESETS: { name: string; tokens: ThemeTokens }[] = [
  {
    name: 'Docbel mauve',
    tokens: { primary: '#7C3AED', accent: '#7C3AED' },
  },
  {
    name: 'Sombre élégant',
    tokens: {
      primary: '#3B82F6',
      background: '#0F172A',
      foreground: '#F1F5F9',
      muted: '#1E293B',
      border: '#334155',
    },
  },
  {
    name: 'Pastel apaisant',
    tokens: {
      primary: '#7C3AED',
      background: '#FAF5FF',
      foreground: '#1F2937',
      muted: '#F3E8FF',
      border: '#E9D5FF',
    },
  },
  {
    name: 'Énergique orange',
    tokens: { primary: '#EA580C', accent: '#F97316' },
  },
  {
    name: 'Sobre noir',
    tokens: { primary: '#000000', accent: '#000000' },
  },
  {
    name: 'Forêt verte',
    tokens: { primary: '#059669', accent: '#10B981' },
  },
]
