'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, Music } from 'lucide-react'
import type {
  AudioProps,
  CarouselProps,
  BeforeAfterProps,
  LogoWallProps,
  SvgIllustrationProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── Audio ───────────────────────────

export function AudioBlock({ url, fileId, title, artist, caption }: AudioProps) {
  const src = fileId ? `/api/files/${fileId}/download` : url
  if (!src) {
    return (
      <div className="rounded-lg border border-dashed bg-muted px-4 py-6 text-sm text-muted-foreground flex items-center gap-3">
        <Music className="size-5" />
        Audio non configuré
      </div>
    )
  }
  return (
    <div className="rounded-2xl border bg-card p-4 my-2">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Music className="size-5" />
        </div>
        {(title || artist) && (
          <div className="min-w-0">
            {title && <div className="font-semibold truncate">{title}</div>}
            {artist && <div className="text-xs text-muted-foreground truncate">{artist}</div>}
          </div>
        )}
      </div>
      <audio controls className="w-full">
        <source src={src} />
        Votre navigateur ne supporte pas l’audio.
      </audio>
      {caption && (
        <p className="mt-2 text-xs text-muted-foreground text-center">{caption}</p>
      )}
    </div>
  )
}

// ─────────────────────────── Carousel ───────────────────────────

export function CarouselBlock({
  slides,
  autoplay,
  interval = 5000,
  showDots = true,
  showArrows = true,
}: CarouselProps) {
  const [active, setActive] = React.useState(0)

  React.useEffect(() => {
    if (!autoplay || slides.length <= 1) return
    const t = setInterval(() => {
      setActive((a) => (a + 1) % slides.length)
    }, interval)
    return () => clearInterval(t)
  }, [autoplay, interval, slides.length])

  if (slides.length === 0) {
    return (
      <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-muted-foreground">
        Carousel vide
      </div>
    )
  }

  const slide = slides[active]
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-muted my-2">
      <div className="aspect-video">
        {slide.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image}
            alt={slide.alt || ''}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted" />
        )}
      </div>
      {slide.caption && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
          {slide.caption}
        </div>
      )}
      {showArrows && slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setActive((a) => (a - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur flex items-center justify-center transition"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setActive((a) => (a + 1) % slides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur flex items-center justify-center transition"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
      {showDots && slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Inner component: lets us measure the container width via ResizeObserver
// in an effect (instead of reading the ref during render).
function BeforeImage({
  src,
  alt,
  containerRef,
}: {
  src: string
  alt: string
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [width, setWidth] = React.useState<number>(0)
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.offsetWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover absolute inset-0"
      style={width ? { width: `${width}px` } : undefined}
      draggable={false}
    />
  )
}

// ─────────────────────────── Before / After ───────────────────────────

export function BeforeAfterBlock({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Avant',
  afterLabel = 'Après',
}: BeforeAfterProps) {
  const [position, setPosition] = React.useState(50)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const updateFromEvent = React.useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  React.useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => updateFromEvent(e.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, updateFromEvent])

  if (!beforeUrl || !afterUrl) {
    return (
      <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Configurez les images &laquo;&nbsp;avant&nbsp;&raquo; et &laquo;&nbsp;après&nbsp;&raquo;
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl select-none cursor-ew-resize"
      onMouseDown={(e) => {
        setDragging(true)
        updateFromEvent(e.clientX)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="w-full block" draggable={false} />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <BeforeImage src={beforeUrl} alt={beforeLabel} containerRef={containerRef} />
      </div>
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-md pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-9 rounded-full bg-white shadow-lg flex items-center justify-center">
          <ChevronLeft className="size-3 -mr-1" />
          <ChevronRight className="size-3 -ml-1" />
        </div>
      </div>
      <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white font-medium pointer-events-none">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white font-medium pointer-events-none">
        {afterLabel}
      </div>
    </div>
  )
}

// ─────────────────────────── Logo Wall ───────────────────────────

export function LogoWallBlock({
  title,
  logos,
  variant = 'grid',
  grayscale = true,
}: LogoWallProps) {
  return (
    <div className="w-full py-8">
      <div className="mx-auto max-w-7xl px-6">
        {title && (
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
        )}
        {variant === 'marquee' ? (
          <div className="overflow-hidden">
            <div
              className={cn(
                'flex items-center gap-12 animate-[marquee_30s_linear_infinite]',
                grayscale && 'opacity-70 grayscale hover:grayscale-0 hover:opacity-100 transition'
              )}
              style={{ animation: 'marquee 30s linear infinite' }}
            >
              {[...logos, ...logos].map((logo, i) =>
                logo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={logo.url}
                    alt={logo.alt}
                    className="h-10 object-contain shrink-0"
                  />
                ) : null
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center',
              grayscale && '[&>*]:opacity-70 [&>*]:grayscale [&>*:hover]:grayscale-0 [&>*:hover]:opacity-100'
            )}
          >
            {logos.map((logo, i) =>
              logo.url ? (
                <a
                  key={i}
                  href={logo.href || '#'}
                  className="flex items-center justify-center transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.url} alt={logo.alt} className="h-10 object-contain" />
                </a>
              ) : (
                <div
                  key={i}
                  className="h-10 rounded bg-muted/40 flex items-center justify-center text-xs text-muted-foreground"
                >
                  {logo.alt}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── SVG Illustration ───────────────────────────

export function SvgIllustrationBlock({ svg, width, height }: SvgIllustrationProps) {
  return (
    <div
      className="my-2 inline-flex items-center justify-center"
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
