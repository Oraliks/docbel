'use client'

import React from 'react'
import type {
  ImageProps,
  VideoProps,
  GalleryProps,
  EmbedProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'
import { ImageOff } from 'lucide-react'

// ─────────────────────────────── Image ───────────────────────────────

const RATIO_CLASS: Record<NonNullable<ImageProps['ratio']>, string> = {
  auto: '',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
  '16:9': 'aspect-video',
  '21:9': 'aspect-[21/9]',
}

const ROUNDED_CLASS: Record<NonNullable<ImageProps['rounded']>, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-lg',
  lg: 'rounded-2xl',
  full: 'rounded-full',
}

export function ImageBlock({
  url,
  alt,
  caption,
  ratio = 'auto',
  fit = 'cover',
  rounded = 'md',
}: ImageProps) {
  return (
    <figure className="w-full">
      {url ? (
        <div className={cn('overflow-hidden bg-muted', RATIO_CLASS[ratio], ROUNDED_CLASS[rounded])}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className={cn(
              'w-full h-full',
              fit === 'cover' ? 'object-cover' : 'object-contain'
            )}
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center bg-muted text-muted-foreground border border-dashed',
            RATIO_CLASS[ratio] || 'aspect-video',
            ROUNDED_CLASS[rounded]
          )}
        >
          <ImageOff className="size-8" />
        </div>
      )}
      {caption && (
        <figcaption className="mt-2 text-sm text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────────── Video ───────────────────────────────

function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

function vimeoEmbed(url: string) {
  const m = url.match(/vimeo\.com\/(\d+)/)
  return m ? `https://player.vimeo.com/video/${m[1]}` : null
}
function tiktokEmbed(url: string) {
  const m = url.match(/tiktok\.com\/[@\w.-]+\/video\/(\d+)/)
  return m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null
}
function dailymotionEmbed(url: string) {
  const m = url.match(/dailymotion\.com\/(?:video\/|embed\/video\/)([\w]+)/)
  return m ? `https://www.dailymotion.com/embed/video/${m[1]}` : null
}
function loomEmbed(url: string) {
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/)
  return m ? `https://www.loom.com/embed/${m[1]}` : null
}

export function VideoBlock({
  url,
  provider,
  caption,
  autoplay,
  controls = true,
  fileId,
}: VideoProps) {
  // For mp4 with a fileId, resolve via the file manager URL.
  const sourceUrl = fileId && provider === 'mp4' ? `/api/files/${fileId}/download` : url

  let embedUrl: string | null = null
  if (provider === 'youtube') embedUrl = youtubeEmbed(url)
  else if (provider === 'vimeo') embedUrl = vimeoEmbed(url)
  else if (provider === 'tiktok') embedUrl = tiktokEmbed(url)
  else if (provider === 'dailymotion') embedUrl = dailymotionEmbed(url)
  else if (provider === 'loom') embedUrl = loomEmbed(url)

  if (!sourceUrl) {
    return (
      <div className="aspect-video flex items-center justify-center bg-muted text-muted-foreground rounded-lg border border-dashed">
        Vidéo non configurée
      </div>
    )
  }

  // TikTok looks best in 9:16 portrait
  const aspectClass = provider === 'tiktok' ? 'aspect-[9/16] max-w-[340px] mx-auto' : 'aspect-video'

  return (
    <figure className="w-full">
      <div className={cn('overflow-hidden rounded-lg bg-black', aspectClass)}>
        {provider === 'mp4' ? (
          <video
            src={sourceUrl}
            className="w-full h-full"
            controls={controls}
            autoPlay={autoplay}
            muted={autoplay}
            playsInline
          />
        ) : embedUrl ? (
          <iframe
            src={`${embedUrl}${autoplay ? (embedUrl.includes('?') ? '&' : '?') + 'autoplay=1&mute=1' : ''}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="w-full h-full border-0"
            title={caption || 'Vidéo'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
            URL invalide pour {provider}
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-muted-foreground text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────────── Gallery ───────────────────────────────

const GAP_CLASS: Record<NonNullable<GalleryProps['gap']>, string> = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

const COL_CLASS: Record<GalleryProps['columns'], string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export function GalleryBlock({
  items,
  columns,
  variant = 'grid',
  gap = 'md',
}: GalleryProps) {
  if (!items || items.length === 0) {
    return (
      <div className="aspect-[3/1] flex items-center justify-center bg-muted text-muted-foreground rounded-lg border border-dashed">
        Galerie vide — ajoutez des images
      </div>
    )
  }

  if (variant === 'masonry') {
    return (
      <div className={cn('columns-2 md:columns-3', GAP_CLASS[gap])}>
        {items.map((item, idx) => (
          <figure key={idx} className="mb-4 break-inside-avoid">
            {item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.alt}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="aspect-square rounded-lg bg-muted" />
            )}
            {item.caption && (
              <figcaption className="mt-1 text-xs text-muted-foreground">
                {item.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid', COL_CLASS[columns], GAP_CLASS[gap])}>
      {items.map((item, idx) => (
        <figure key={idx}>
          <div className="aspect-square overflow-hidden rounded-lg bg-muted">
            {item.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.alt} className="w-full h-full object-cover" />
            ) : null}
          </div>
          {item.caption && (
            <figcaption className="mt-1 text-xs text-muted-foreground">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

// ─────────────────────────────── Embed ───────────────────────────────

export function EmbedBlock({ html, height = 400 }: EmbedProps) {
  if (!html) {
    return (
      <div
        className="flex items-center justify-center bg-muted text-muted-foreground rounded-lg border border-dashed"
        style={{ height }}
      >
        Embed vide
      </div>
    )
  }
  return (
    <div
      className="w-full overflow-hidden rounded-lg"
      style={{ minHeight: height }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
