'use client'

import React from 'react'
import { Loader2, History, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import type { BlockProps } from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

interface RevisionRow {
  id: string
  title: string
  metaTitle?: string | null
  metaDesc?: string | null
  ogImage?: string | null
  createdBy?: string | null
  createdAt: string
}

interface VersionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  onRestore: (data: { title: string; blocks: BlockProps[] }) => void
}

export function VersionsDialog({ open, onOpenChange, pageId, onRestore }: VersionsDialogProps) {
  const [items, setItems] = React.useState<RevisionRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [restoring, setRestoring] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    fetch(`/api/pages/${pageId}/revisions`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items || []))
      .catch(() => toast.error('Impossible de charger les versions'))
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [open, pageId])

  const handleRestore = async (rev: RevisionRow) => {
    setRestoring(rev.id)
    try {
      const res = await fetch(`/api/pages/${pageId}/revisions/${rev.id}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const blocks: BlockProps[] = Array.isArray(data.blocks) ? data.blocks : []
      onRestore({ title: data.title, blocks })
      toast.success(`Version du ${formatDate(rev.createdAt)} restaurée`)
      onOpenChange(false)
    } catch {
      toast.error('Erreur lors de la restauration')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" />
            Historique des versions
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] -mx-1">
          <div className="px-1 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Aucune version archivée pour cette page.
              </div>
            ) : (
              items.map((rev, idx) => {
                const isLatest = idx === 0
                const isActive = selected === rev.id
                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelected(rev.id)}
                    className={cn(
                      'rounded-lg border p-3 cursor-pointer transition',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xs font-mono text-muted-foreground pt-0.5 w-12">
                        {idx === 0 ? 'now' : `–${idx}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate">{rev.title}</div>
                          {isLatest && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium">
                              Actuelle
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(rev.createdAt)}
                          {rev.createdBy && ` · ${rev.createdBy}`}
                        </div>
                        {rev.metaDesc && (
                          <div className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                            {rev.metaDesc}
                          </div>
                        )}
                      </div>
                      {!isLatest && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoring === rev.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRestore(rev)
                          }}
                          className="shrink-0"
                        >
                          {restoring === rev.id ? (
                            <Loader2 className="size-3 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3 mr-1" />
                          )}
                          Restaurer
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>{items.length} version(s)</span>
          <span>
            Restaurer une version remplace le contenu actuel · une nouvelle révision sera créée.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return iso
  }
}
