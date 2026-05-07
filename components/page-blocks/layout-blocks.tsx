'use client'

import React from 'react'
import type {
  SectionProps,
  ContainerProps,
  ColumnsProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────────── Section ───────────────────────────────

export function SectionBlock({
  bgType = 'color',
  bgColor,
  bgGradient,
  bgImage,
  bgOverlay,
  fullWidth = true,
  children,
}: SectionProps & { children?: React.ReactNode }) {
  const bgStyle: React.CSSProperties = {}

  if (bgType === 'color' && bgColor) bgStyle.backgroundColor = bgColor
  if (bgType === 'gradient' && bgGradient) bgStyle.backgroundImage = bgGradient
  if (bgType === 'image' && bgImage) {
    bgStyle.backgroundImage = `url(${bgImage})`
    bgStyle.backgroundSize = 'cover'
    bgStyle.backgroundPosition = 'center'
  }

  return (
    <section
      className={cn('relative w-full', fullWidth ? '' : 'rounded-2xl overflow-hidden')}
      style={bgStyle}
    >
      {bgOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: bgOverlay }}
          aria-hidden
        />
      )}
      <div className="relative py-8 md:py-12">{children}</div>
    </section>
  )
}

// ─────────────────────────────── Container ───────────────────────────────

const WIDTH_CLASS: Record<NonNullable<ContainerProps['width']>, string> = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  full: 'max-w-none',
}

export function ContainerBlock({
  width = 'lg',
  children,
}: ContainerProps & { children?: React.ReactNode }) {
  return <div className={cn('mx-auto px-4 md:px-6 w-full', WIDTH_CLASS[width])}>{children}</div>
}

// ─────────────────────────────── Columns ───────────────────────────────

const COLUMN_GAP: Record<NonNullable<ColumnsProps['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-6',
  lg: 'gap-10',
}

const COLUMN_GRID: Record<ColumnsProps['count'], string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
}

export function ColumnsBlock({
  count,
  gap = 'md',
  children,
}: ColumnsProps & { children?: React.ReactNode }) {
  return (
    <div className={cn('grid w-full', COLUMN_GRID[count], COLUMN_GAP[gap])}>{children}</div>
  )
}
