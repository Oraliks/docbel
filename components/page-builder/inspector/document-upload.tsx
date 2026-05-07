'use client'

import React from 'react'
import {
  Upload,
  Loader2,
  FolderOpen,
  Link as LinkIcon,
  Trash2,
  Check,
  X,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { FilePickerDialog } from './file-picker-dialog'

interface DocumentUploadProps {
  fileId?: string
  url?: string
  onChange: (next: { fileId?: string; url?: string }) => void
}

const MAX_SIZE = 25 * 1024 * 1024

export function DocumentUpload({ fileId, url, onChange }: DocumentUploadProps) {
  const [uploading, setUploading] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [urlMode, setUrlMode] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
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
      onChange({ fileId: data.id, url: undefined })
      toast.success('Fichier ajouté')
    } catch (e) {
      console.error(e)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setUploading(false)
    }
  }

  const handlePicker = (pickedUrl: string) => {
    // FilePickerDialog returns a URL like /api/files/{id}/download — extract id.
    const m = pickedUrl.match(/\/api\/files\/([^/]+)\/download/)
    if (m) onChange({ fileId: m[1], url: undefined })
    else onChange({ url: pickedUrl, fileId: undefined })
  }

  const submitUrl = () => {
    const v = urlInput.trim()
    if (!v) return
    onChange({ url: v, fileId: undefined })
    setUrlInput('')
    setUrlMode(false)
  }

  const hasFile = !!(fileId || url)

  if (hasFile) {
    return (
      <>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
          <FileText className="size-4 text-primary shrink-0" />
          <div className="text-xs flex-1 min-w-0 truncate">
            {fileId ? `Fichier #${fileId.slice(0, 8)}…` : url}
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onChange({ fileId: undefined, url: undefined })}
            title="Retirer"
          >
            <Trash2 className="size-3 text-destructive" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3 mr-1" />
            Remplacer
          </Button>
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
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
            e.target.value = ''
          }}
        />
        <FilePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handlePicker} />
      </>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input hover:border-muted-foreground hover:bg-muted/50 transition-colors h-24 text-xs text-muted-foreground"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        <span className="font-medium">{uploading ? 'Téléchargement…' : 'Cliquer pour uploader'}</span>
        <span className="text-[10px] text-muted-foreground/70">PDF, DOCX, XLSX, ZIP… max 25 Mo</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void upload(f)
          e.target.value = ''
        }}
      />

      {urlMode ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemple.com/doc.pdf"
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

      <FilePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={handlePicker} />
    </div>
  )
}
