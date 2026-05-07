'use client'

import React from 'react'
import { MapPin, X as XIcon } from 'lucide-react'
import type {
  HtmlRawProps,
  CustomCssProps,
  GdprNoticeProps,
  MapEmbedProps,
  MarqueeProps,
  TiltCardProps,
  ImageHotspotsProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

// ─────────────────────────── HTML raw ───────────────────────────

export function HtmlRawBlock({ html }: HtmlRawProps) {
  return (
    <div
      className="my-2 prose-tight max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─────────────────────────── Custom CSS ───────────────────────────

export function CustomCssBlock({ css }: CustomCssProps) {
  return (
    <style
      dangerouslySetInnerHTML={{ __html: css }}
    />
  )
}

// ─────────────────────────── GDPR Notice ───────────────────────────

const GDPR_KEY = 'docbel-gdpr-consent'

export function GdprNoticeBlock({
  message,
  acceptText,
  declineText,
  link,
  linkText,
}: GdprNoticeProps) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(GDPR_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem(GDPR_KEY, 'accepted')
    setVisible(false)
  }
  const decline = () => {
    localStorage.setItem(GDPR_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[calc(100%-2rem)] rounded-2xl border bg-card shadow-2xl p-5 animate-in slide-in-from-bottom-4 duration-300">
      <p className="text-sm leading-relaxed">{message}</p>
      {link && linkText && (
        <a href={link} className="text-xs text-primary hover:underline mt-2 inline-block">
          {linkText}
        </a>
      )}
      <div className="mt-4 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={accept}
          className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          {acceptText}
        </button>
        {declineText && (
          <button
            type="button"
            onClick={decline}
            className="flex-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {declineText}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────── Map embed (OpenStreetMap) ───────────────────────────

export function MapEmbedBlock({ query, height = 400, caption }: MapEmbedProps) {
  // Use OpenStreetMap embed via search
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent('4.30,50.83,4.42,50.88')}&marker=${encodeURIComponent('50.85,4.36')}&query=${encodeURIComponent(query)}`

  return (
    <figure className="my-2">
      <div className="rounded-2xl overflow-hidden border" style={{ height }}>
        <iframe
          src={url}
          title={query}
          className="w-full h-full border-0"
          loading="lazy"
        />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
          <MapPin className="size-3.5" />
          {caption}
        </figcaption>
      ) : (
        <figcaption className="mt-2 text-sm text-muted-foreground text-center">
          📍 {query}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────── Marquee ───────────────────────────

const MARQUEE_DURATION: Record<NonNullable<MarqueeProps['speed']>, string> = {
  slow: '40s',
  normal: '20s',
  fast: '10s',
}

export function MarqueeBlock({ text, speed = 'normal', reverse, color }: MarqueeProps) {
  // Repeat the text many times so it fills the line
  const segments = Array.from({ length: 4 }).map((_, i) => (
    <span key={i} className="inline-block">
      {text}
    </span>
  ))
  return (
    <div
      className="my-2 overflow-hidden whitespace-nowrap py-3 border-y"
      style={{ color: color || undefined }}
    >
      <div
        className="inline-flex gap-12 font-bold text-lg"
        style={{
          animation: `marquee ${MARQUEE_DURATION[speed]} linear infinite`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {segments}
      </div>
    </div>
  )
}

// ─────────────────────────── Tilt Card ───────────────────────────

export function TiltCardBlock({ title, description, image, link }: TiltCardProps) {
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 })
  const ref = React.useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    setTilt({
      x: (py - 0.5) * -10,
      y: (px - 0.5) * 10,
    })
  }

  const onLeave = () => setTilt({ x: 0, y: 0 })

  const Inner = (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="rounded-2xl border bg-card p-6 transition-transform duration-200 ease-out shadow-lg hover:shadow-2xl"
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="w-full aspect-video object-cover rounded-lg mb-4"
          style={{ transform: 'translateZ(20px)' }}
        />
      )}
      <h3 className="font-semibold text-lg" style={{ transform: 'translateZ(40px)' }}>
        {title}
      </h3>
      {description && (
        <p
          className="mt-2 text-sm text-muted-foreground"
          style={{ transform: 'translateZ(20px)' }}
        >
          {description}
        </p>
      )}
    </div>
  )

  if (link) {
    return (
      <a href={link} className="block my-2">
        {Inner}
      </a>
    )
  }
  return <div className="my-2">{Inner}</div>
}

// ─────────────────────────── Image Hotspots ───────────────────────────

export function ImageHotspotsBlock({ image, alt, hotspots }: ImageHotspotsProps) {
  const [active, setActive] = React.useState<number | null>(null)
  if (!image) {
    return (
      <div className="aspect-video rounded-lg border border-dashed bg-muted flex items-center justify-center text-sm text-muted-foreground my-2">
        Configurez une image pour les points d&apos;intérêt
      </div>
    )
  }
  return (
    <figure className="relative my-2 rounded-2xl overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt={alt || ''} className="w-full block" />
      {hotspots.map((h, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setActive(active === i ? null : i)}
          className={cn(
            'absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg transition-all hover:scale-110',
            active === i && 'scale-125 ring-4 ring-primary/30'
          )}
          style={{ left: `${h.x}%`, top: `${h.y}%` }}
        >
          {i + 1}
          <span className="absolute inline-flex size-full rounded-full bg-primary/40 animate-ping" />
        </button>
      ))}
      {active !== null && (
        <div
          className="absolute z-10 -translate-x-1/2 mt-3 max-w-xs rounded-xl bg-card shadow-2xl border p-3 text-sm"
          style={{ left: `${hotspots[active].x}%`, top: `${hotspots[active].y}%` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="font-semibold">{hotspots[active].title}</div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="opacity-60 hover:opacity-100"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {hotspots[active].description}
          </p>
        </div>
      )}
    </figure>
  )
}
