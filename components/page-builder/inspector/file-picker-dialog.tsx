'use client'

import React from 'react'
import { Folder, ChevronRight, Image as ImageIcon, Loader2, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  fileType?: string
  parentId?: string | null
  isPrivate?: boolean
  filePath?: string
  createdAt?: string
}

interface Crumb {
  id: string | null
  name: string
}

interface FilePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string) => void
}

export function FilePickerDialog({ open, onOpenChange, onSelect }: FilePickerDialogProps) {
  const [files, setFiles] = React.useState<FileItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [folderId, setFolderId] = React.useState<string | null>(null)
  const [crumbs, setCrumbs] = React.useState<Crumb[]>([{ id: null, name: 'Racine' }])
  const [query, setQuery] = React.useState('')

  // Fetch files for the current folder when the dialog is opened or the folder changes.
  // The cleanup function aborts in-flight requests to avoid stale state.
  React.useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const params = new URLSearchParams()
    if (folderId) params.set('parentId', folderId)
    fetch(`/api/files?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data: FileItem[]) => setFiles(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.name !== 'AbortError') toast.error('Impossible de charger la bibliothèque')
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [open, folderId])

  // Reset internal state when the dialog closes (event-based, not effect).
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFolderId(null)
      setCrumbs([{ id: null, name: 'Racine' }])
      setQuery('')
    }
    onOpenChange(next)
  }

  const filtered = React.useMemo(() => {
    const items = files.filter(
      (f) => f.type === 'folder' || f.fileType === 'image'
    )
    if (!query.trim()) return items
    const q = query.toLowerCase().trim()
    return items.filter((f) => f.name.toLowerCase().includes(q))
  }, [files, query])

  const navigateInto = (folder: FileItem) => {
    setFolderId(folder.id)
    setCrumbs((prev) => [...prev, { id: folder.id, name: folder.name }])
  }

  const navigateTo = (idx: number) => {
    const target = crumbs[idx]
    setFolderId(target.id)
    setCrumbs(crumbs.slice(0, idx + 1))
  }

  const handlePick = (file: FileItem) => {
    onSelect(`/api/files/${file.id}/download`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bibliothèque d&apos;images</DialogTitle>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground -mt-2">
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c.id ?? 'root'}-${i}`}>
              {i > 0 && <ChevronRight className="size-3" />}
              <button
                type="button"
                onClick={() => navigateTo(i)}
                className={cn(
                  'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition',
                  i === crumbs.length - 1 && 'text-foreground font-medium'
                )}
              >
                {c.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans ce dossier…"
            className="pl-8 h-9"
          />
        </div>

        {/* Grid */}
        <ScrollArea className="h-[420px] -mx-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-1">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
                {query
                  ? `Aucun résultat pour « ${query} »`
                  : 'Aucune image dans ce dossier'}
              </div>
            ) : (
              filtered.map((f) =>
                f.type === 'folder' ? (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => navigateInto(f)}
                    className="group/item flex flex-col items-center gap-2 rounded-lg border bg-card p-3 hover:border-primary hover:bg-primary/5 transition text-center"
                  >
                    <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover/item:bg-primary group-hover/item:text-primary-foreground transition">
                      <Folder className="size-5" />
                    </div>
                    <span className="text-xs font-medium truncate w-full">{f.name}</span>
                  </button>
                ) : (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handlePick(f)}
                    className="group/item flex flex-col gap-1.5 rounded-lg border bg-card p-1.5 hover:border-primary hover:shadow-md transition text-left overflow-hidden"
                  >
                    <div className="aspect-square overflow-hidden rounded-md bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/files/${f.id}/download`}
                        alt={f.name}
                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex items-center gap-1 px-1">
                      <ImageIcon className="size-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] truncate flex-1">{f.name}</span>
                    </div>
                  </button>
                )
              )
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>{filtered.filter((f) => f.type === 'file').length} image(s) · {filtered.filter((f) => f.type === 'folder').length} dossier(s)</span>
          <span>Cliquez pour sélectionner</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
