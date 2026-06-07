'use client'

import React from 'react'
import {
  ImagePlus,
  Loader2,
  FolderOpen,
  Link as LinkIcon,
  Upload,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { FilePickerDialog } from './file-picker-dialog'

interface ImageUploadProps {
  value: string
  onChange: (url: string) => void
  /** Compact mode: smaller preview, used inside repeating items (gallery, testimonials). */
  compact?: boolean
  /**
   * Optionnel — appelé pour appliquer un point focal suggéré par l'IA (0-100).
   * Fourni par les contrôles d'image qui gèrent un point focal (object-position).
   * Si absent, le bouton « Point focal auto (IA) » n'est pas rendu.
   */
  onFocalChange?: (focal: { focalX: number; focalY: number }) => void
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

interface UnsplashResult {
  thumb: string
  url: string
  alt: string
  credit: string
}

export function ImageUpload({
  value,
  onChange,
  compact = false,
  onFocalChange,
}: ImageUploadProps) {
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [focalLoading, setFocalLoading] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [urlMode, setUrlMode] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // ────── Unsplash search ──────
  const [unsplashMode, setUnsplashMode] = React.useState(false)
  const [unsplashQuery, setUnsplashQuery] = React.useState('')
  const [unsplashLoading, setUnsplashLoading] = React.useState(false)
  const [unsplashResults, setUnsplashResults] = React.useState<UnsplashResult[]>([])
  const [unsplashSearched, setUnsplashSearched] = React.useState(false)

  const searchUnsplash = React.useCallback(async () => {
    const q = unsplashQuery.trim()
    if (!q) return
    setUnsplashLoading(true)
    try {
      const res = await fetch(`/api/page-builder/unsplash?q=${encodeURIComponent(q)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la recherche')
        return
      }
      if (data.disabled) {
        toast.message('Unsplash non configuré')
        setUnsplashResults([])
        setUnsplashSearched(true)
        return
      }
      setUnsplashResults(Array.isArray(data.results) ? data.results : [])
      setUnsplashSearched(true)
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors de la recherche')
    } finally {
      setUnsplashLoading(false)
    }
  }, [unsplashQuery])

  const pickUnsplash = (r: UnsplashResult) => {
    onChange(r.url)
    setUnsplashMode(false)
    setUnsplashQuery('')
    setUnsplashResults([])
    setUnsplashSearched(false)
    toast.success(r.credit ? `Photo de ${r.credit} · Unsplash` : 'Image Unsplash ajoutée')
  }

  const upload = React.useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('Type non supporté · JPG, PNG, WebP, GIF ou SVG')
        return
      }
      if (file.size > MAX_SIZE) {
        toast.error(`Fichier trop volumineux · max ${MAX_SIZE / 1024 / 1024} Mo`)
        return
      }

      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('isPrivate', 'false')
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(err.error || 'Erreur lors du téléchargement')
          return
        }
        const data = await res.json()
        onChange(`/api/files/${data.id}/download`)
        toast.success('Image ajoutée à la bibliothèque')
      } catch (e) {
        console.error(e)
        toast.error('Erreur lors du téléchargement')
      } finally {
        setUploading(false)
      }
    },
    [onChange]
  )

  const handleFile = (file: File) => {
    void upload(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const handlePicker = (url: string) => onChange(url)

  const submitUrl = () => {
    const v = urlInput.trim()
    if (!v) return
    onChange(v)
    setUrlInput('')
    setUrlMode(false)
  }

  // ────── Point focal auto (IA vision) ──────
  const suggestFocal = React.useCallback(async () => {
    if (!value || !onFocalChange) return
    setFocalLoading(true)
    try {
      const res = await fetch('/api/page-builder/ai-focal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ imageUrl: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Échec de la suggestion de point focal')
        return
      }
      if (data.aiDisabled) {
        toast.message("L'assistant IA n'est pas configuré")
        return
      }
      if (typeof data.focalX !== 'number' || typeof data.focalY !== 'number') {
        toast.error('Réponse IA invalide')
        return
      }
      onFocalChange({ focalX: data.focalX, focalY: data.focalY })
      toast.success(
        data.fallback
          ? 'Sujet non détecté — point focal centré'
          : 'Point focal suggéré par l’IA'
      )
    } catch (e) {
      console.error(e)
      toast.error('Échec de la suggestion de point focal')
    } finally {
      setFocalLoading(false)
    }
  }, [value, onFocalChange])

  // ────── With value: preview + actions ──────
  if (value) {
    return (
      <>
        <div
          className={cn(
            'relative group/upload overflow-hidden rounded-md border bg-muted',
            compact ? 'h-24' : 'h-36'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.opacity = '0.3'
            }}
          />
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/upload:opacity-100 transition flex items-center justify-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              title="Remplacer"
            >
              <Upload className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                setPickerOpen(true)
              }}
              title="Bibliothèque"
            >
              <FolderOpen className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2"
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              title="Supprimer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}
        </div>

        {onFocalChange && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 w-full text-xs"
            disabled={focalLoading}
            onClick={() => void suggestFocal()}
            title="Détecter le sujet principal et placer le point focal"
          >
            {focalLoading ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            {focalLoading ? 'Analyse…' : 'Point focal auto (IA)'}
          </Button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />

        <FilePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={handlePicker}
        />
      </>
    )
  }

  // ────── No value: dropzone + actions ──────
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={cn(
          'w-full flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed transition-colors text-xs',
          compact ? 'h-20' : 'h-28 gap-2',
          dragOver
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-input hover:border-muted-foreground hover:bg-muted/50 text-muted-foreground'
        )}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ImagePlus className={compact ? 'size-4' : 'size-5'} />
        )}
        <span className={cn('font-medium', compact && 'text-[10px]')}>
          {uploading ? 'Téléchargement…' : 'Cliquer ou glisser une image'}
        </span>
        {!compact && !uploading && (
          <span className="text-[10px] text-muted-foreground/80">
            JPG, PNG, WebP, GIF · max 5 Mo
          </span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {urlMode ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemple.com/image.jpg"
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitUrl()
              if (e.key === 'Escape') {
                setUrlMode(false)
                setUrlInput('')
              }
            }}
          />
          <Button size="icon-sm" className="h-8 w-8 shrink-0" onClick={submitUrl}>
            <Check className="size-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => {
              setUrlMode(false)
              setUrlInput('')
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : unsplashMode ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={unsplashQuery}
              onChange={(e) => setUnsplashQuery(e.target.value)}
              placeholder="Rechercher sur Unsplash…"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchUnsplash()
                if (e.key === 'Escape') {
                  setUnsplashMode(false)
                  setUnsplashQuery('')
                  setUnsplashResults([])
                  setUnsplashSearched(false)
                }
              }}
            />
            <Button
              size="icon-sm"
              className="h-8 w-8 shrink-0"
              disabled={unsplashLoading || !unsplashQuery.trim()}
              onClick={() => void searchUnsplash()}
              title="Rechercher"
            >
              {unsplashLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                setUnsplashMode(false)
                setUnsplashQuery('')
                setUnsplashResults([])
                setUnsplashSearched(false)
              }}
              title="Fermer"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          {unsplashLoading ? (
            <div className="flex h-24 items-center justify-center text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : unsplashResults.length > 0 ? (
            <>
              <div className="grid max-h-56 grid-cols-3 gap-1 overflow-y-auto">
                {unsplashResults.map((r, i) => (
                  <button
                    key={`${r.url}-${i}`}
                    type="button"
                    onClick={() => pickUnsplash(r)}
                    title={r.credit ? `Photo de ${r.credit}` : r.alt || 'Image Unsplash'}
                    className="group/u relative aspect-square overflow-hidden rounded border bg-muted transition hover:ring-2 hover:ring-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.thumb}
                      alt={r.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover/u:scale-105"
                    />
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/80">
                Photos via Unsplash · crédit photographe appliqué
              </p>
            </>
          ) : unsplashSearched ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              Aucun résultat
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen className="size-3 mr-1" />
            Biblio.
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUnsplashMode(true)}
          >
            <Search className="size-3 mr-1" />
            Unsplash
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUrlMode(true)}
          >
            <LinkIcon className="size-3 mr-1" />
            URL
          </Button>
        </div>
      )}

      <FilePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePicker}
      />
    </div>
  )
}
