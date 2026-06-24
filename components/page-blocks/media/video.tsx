'use client'

import { useRef, useEffect } from 'react'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Field, Group } from '@/components/page-builder/inspector/controls'
import { DocumentUpload as VideoUpload } from '@/components/page-builder/inspector/document-upload'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { videoSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

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

const PROVIDERS: Array<{ value: Props['provider']; label: string; emoji: string }> = [
  { value: 'youtube', label: 'YouTube', emoji: '▶️' },
  { value: 'vimeo', label: 'Vimeo', emoji: '🎬' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { value: 'dailymotion', label: 'Dailymotion', emoji: '📺' },
  { value: 'loom', label: 'Loom', emoji: '🔴' },
  { value: 'mp4', label: 'Upload', emoji: '⬆️' },
]

export const video = defineBlock({
  type: 'video',
  schema,
  defaults: { url: '', provider: 'youtube', caption: '', autoplay: false, controls: true },
  meta: {
    name: 'Vidéo',
    description: 'YouTube, Vimeo ou MP4',
    category: 'media',
    icon: 'video',
    shortcuts: ['video', 'youtube'],
  },
  Render: ({ props }) => {
    const t = useTranslations('public.blocks')
    const { url, provider, caption, autoplay, controls = true, fileId, controlId } = props
    const videoRef = useRef<HTMLVideoElement>(null)
    useEffect(() => {
      if (!controlId || provider !== 'mp4') return
      const handler = (e: Event) => {
        const d = (e as CustomEvent<{ id?: string; playing?: boolean }>).detail
        if (d?.id !== controlId) return
        const v = videoRef.current
        if (!v) return
        if (d.playing) void v.play().catch(() => {})
        else v.pause()
      }
      window.addEventListener('beldoc:video-control', handler as EventListener)
      return () => window.removeEventListener('beldoc:video-control', handler as EventListener)
    }, [controlId, provider])
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
          {t('video.notConfigured')}
        </div>
      )
    }

    const aspectClass =
      provider === 'tiktok' ? 'aspect-[9/16] max-w-[340px] mx-auto' : 'aspect-video'

    return (
      <figure className="w-full">
        <div className={cn('overflow-hidden rounded-lg bg-black', aspectClass)}>
          {provider === 'mp4' ? (
            <video
              ref={videoRef}
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
              title={caption || t('video.iframeTitle')}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/70 text-sm">
              {t('video.invalidUrl', { provider })}
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
  },
  Fields: ({ props, onChange }) => (
    <Group title="Contenu" defaultOpen>
      <Field label="Source">
        <div className="grid grid-cols-3 gap-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ provider: p.value, fileId: undefined, url: '' })}
              className={`flex flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 text-[10px] font-medium transition ${
                props.provider === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:border-muted-foreground'
              }`}
            >
              <span className="text-base leading-none">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      {props.provider === 'mp4' ? (
        <Field label="Fichier vidéo">
          <VideoUpload fileId={props.fileId} url={props.url} onChange={(next) => onChange(next)} />
        </Field>
      ) : (
        <Field
          label="URL"
          hint={
            props.provider === 'youtube'
              ? 'Lien complet de la vidéo (watch, embed ou shorts)'
              : props.provider === 'tiktok'
                ? 'Format : https://tiktok.com/@user/video/...'
                : ''
          }
        >
          <Input
            value={props.url}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder={
              props.provider === 'youtube'
                ? 'https://youtube.com/watch?v=…'
                : props.provider === 'vimeo'
                  ? 'https://vimeo.com/…'
                  : props.provider === 'tiktok'
                    ? 'https://tiktok.com/@…/video/…'
                    : props.provider === 'dailymotion'
                      ? 'https://dailymotion.com/video/…'
                      : 'https://loom.com/share/…'
            }
          />
        </Field>
      )}

      <Field label="Légende">
        <Input
          value={props.caption ?? ''}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Lecture auto" className="flex-1">
          <span className="sr-only">Autoplay</span>
        </Field>
        <Switch
          checked={props.autoplay ?? false}
          onCheckedChange={(v) => onChange({ autoplay: v })}
        />
      </div>
      <div className="flex items-center justify-between gap-4 py-1">
        <Field label="Contrôles" className="flex-1">
          <span className="sr-only">Controls</span>
        </Field>
        <Switch
          checked={props.controls ?? true}
          onCheckedChange={(v) => onChange({ controls: v })}
        />
      </div>
      <Field label="ID de contrôle" hint="Pour les actions « Lire / Pause » (mp4 uniquement)">
        <Input
          value={props.controlId ?? ''}
          onChange={(e) => onChange({ controlId: e.target.value || undefined })}
          placeholder="ex. promo-video"
        />
      </Field>
    </Group>
  ),
})
