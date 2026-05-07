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
}

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

export function ImageUpload({ value, onChange, compact = false }: ImageUploadProps) {
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [urlMode, setUrlMode] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen className="size-3 mr-1" />
            Bibliothèque
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUrlMode(true)}
          >
            <LinkIcon className="size-3 mr-1" />
            URL externe
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
