'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface TableOption {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  category: { slug: string; labelFr: string }
}

interface FileSlot {
  id: string
  file: File
  tableId: string | null
  tableLabel: string | null
  matchConfidence: number
  matchReason: string
  status: 'pending' | 'uploading' | 'done' | 'error' | 'unmatched'
  result?: {
    inserted: number
    updated: number
    unchanged: number
    errors: { row: number; message: string }[]
  }
  errorMessage?: string
}

export default function ImportBatchPage() {
  const [tables, setTables] = useState<TableOption[]>([])
  const [slots, setSlots] = useState<FileSlot[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch('/api/lookup/tables')
      const data = await res.json()
      const flat: TableOption[] = []
      for (const cat of data.categories ?? []) {
        for (const t of cat.tables ?? []) {
          flat.push({ ...t, category: { slug: cat.slug, labelFr: cat.labelFr } })
        }
      }
      setTables(flat)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement tables impossible')
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTables()
  }, [loadTables])

  const matchFiles = useCallback(
    async (newSlots: FileSlot[], currentTables: TableOption[]) => {
      const fileNames = newSlots.map((s) => s.file.name)
      try {
        const res = await fetch('/api/lookup/match-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileNames }),
        })
        if (!res.ok) return
        const data = await res.json()
        const matches = data.matches as {
          fileName: string
          tableId: string | null
          confidence: number
          reason: string
        }[]
        setSlots((current) =>
          current.map((slot) => {
            const m = matches.find((mm) => mm.fileName === slot.file.name)
            if (!m) return slot
            const t = m.tableId ? currentTables.find((tab) => tab.id === m.tableId) : null
            return {
              ...slot,
              tableId: m.tableId,
              tableLabel: t ? `${t.category.labelFr} · ${t.labelFr}` : null,
              matchConfidence: m.confidence,
              matchReason: m.reason,
              status: m.tableId ? 'pending' : 'unmatched',
            }
          })
        )
      } catch (err) {
        console.error(err)
      }
    },
    []
  )

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const newSlots: FileSlot[] = []
    Array.from(files).forEach((file) => {
      if (!/\.(csv|txt)$/i.test(file.name)) {
        toast.error(`${file.name} : format ignoré (attendu .csv ou .txt)`)
        return
      }
      newSlots.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        tableId: null,
        tableLabel: null,
        matchConfidence: 0,
        matchReason: 'Auto-détection en cours…',
        status: 'pending',
      })
    })
    if (newSlots.length === 0) return
    setSlots((prev) => [...prev, ...newSlots])
    void matchFiles(newSlots, tables)
  }

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }

  const importAll = async () => {
    const queue = slots.filter((s) => s.tableId && s.status === 'pending')
    if (queue.length === 0) {
      toast.error('Aucun fichier prêt à importer')
      return
    }
    setImporting(true)
    try {
      for (const slot of queue) {
        setSlots((prev) =>
          prev.map((s) => (s.id === slot.id ? { ...s, status: 'uploading' } : s))
        )
        try {
          const formData = new FormData()
          formData.append('file', slot.file)
          const res = await fetch(`/api/lookup/tables/${slot.tableId}/import`, {
            method: 'POST',
            body: formData,
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? 'Échec import')
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slot.id ? { ...s, status: 'done', result: body } : s
            )
          )
        } catch (err) {
          setSlots((prev) =>
            prev.map((s) =>
              s.id === slot.id
                ? {
                    ...s,
                    status: 'error',
                    errorMessage: err instanceof Error ? err.message : 'Erreur',
                  }
                : s
            )
          )
        }
      }
      toast.success('Imports terminés')
    } finally {
      setImporting(false)
    }
  }

  const clearDone = () => {
    setSlots((prev) => prev.filter((s) => s.status !== 'done'))
  }

  const clearUnmatched = () => {
    setSlots((prev) => prev.filter((s) => s.status !== 'unmatched'))
  }

  const stats = useMemo(() => {
    const ready = slots.filter((s) => s.tableId && s.status === 'pending').length
    const unmatched = slots.filter((s) => s.status === 'unmatched').length
    const done = slots.filter((s) => s.status === 'done').length
    const error = slots.filter((s) => s.status === 'error').length
    return { total: slots.length, ready, unmatched, done, error }
  }, [slots])

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div>
        <Link
          href="/admin/chomage/lookup"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Lookup
        </Link>
        <h1 className="text-2xl font-bold">Import en lot</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Drag-drop plusieurs CSV exportés depuis le lookup ONEM. Le système détecte
          automatiquement la table cible via le nom interne ONEM. Les fichiers sans
          mapping sont listés en bas pour qu&apos;on les associe ensemble.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addFiles(e.dataTransfer.files)
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragOver ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
            }`}
          >
            <Upload className="mx-auto w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-medium mb-1">Glissez vos CSV ici (drop multiple supporté)</p>
            <p className="text-xs text-muted-foreground mb-4">
              ou sélectionnez plusieurs fichiers
            </p>
            <label className="inline-block cursor-pointer">
              <input
                type="file"
                accept=".csv,.txt"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.currentTarget.files)
                  e.currentTarget.value = ''
                }}
              />
              <Button type="button" render={<span />}>
                <Upload className="w-4 h-4 mr-2" />
                Choisir des fichiers
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      {slots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
              <span>File d&apos;attente ({slots.length})</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {stats.ready > 0 && <span className="text-blue-700">{stats.ready} prêts</span>}
                {stats.unmatched > 0 && (
                  <span className="text-red-700">{stats.unmatched} non matchés</span>
                )}
                {stats.done > 0 && (
                  <span className="text-green-700">{stats.done} importés</span>
                )}
                {stats.error > 0 && (
                  <span className="text-red-700">{stats.error} erreurs</span>
                )}
              </div>
              <div className="flex gap-2">
                {stats.done > 0 && (
                  <Button variant="outline" size="sm" onClick={clearDone}>
                    Nettoyer terminés
                  </Button>
                )}
                {stats.unmatched > 0 && (
                  <Button variant="outline" size="sm" onClick={clearUnmatched}>
                    Retirer non matchés
                  </Button>
                )}
                <Button onClick={importAll} disabled={importing || stats.ready === 0}>
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Import…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importer {stats.ready} fichier{stats.ready > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {slots.map((slot) => (
              <SlotRow key={slot.id} slot={slot} onRemove={() => removeSlot(slot.id)} />
            ))}
          </CardContent>
        </Card>
      )}

      {stats.unmatched > 0 && (
        <Card className="border-orange-300 bg-orange-50/40 dark:bg-orange-950/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">
                  {stats.unmatched} fichier{stats.unmatched > 1 ? 's non matchés' : ' non matché'}
                </p>
                <p className="text-muted-foreground">
                  Ces CSV ne correspondent à aucune table connue. Donne-moi leur nom de fichier
                  exact (ou le contenu de la 1ère ligne <code className="text-xs bg-muted px-1 py-0.5 rounded">Liste des lookups: XYZ</code>)
                  et j&apos;ajoute le mapping <code className="text-xs bg-muted px-1 py-0.5 rounded">exportName</code> dans le seed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SlotRow({
  slot,
  onRemove,
}: {
  slot: FileSlot
  onRemove: () => void
}) {
  const StatusIcon = {
    pending: CheckCircle2,
    uploading: Loader2,
    done: CheckCircle2,
    error: XCircle,
    unmatched: AlertTriangle,
  }[slot.status]
  const statusColor = {
    pending: 'text-blue-600',
    uploading: 'text-blue-600 animate-spin',
    done: 'text-green-600',
    error: 'text-red-600',
    unmatched: 'text-orange-600',
  }[slot.status]
  const rowBg = {
    pending: 'bg-background',
    uploading: 'bg-background',
    done: 'bg-green-50/40 dark:bg-green-950/10 border-green-200',
    error: 'bg-red-50/40 dark:bg-red-950/10 border-red-200',
    unmatched: 'bg-orange-50/40 dark:bg-orange-950/10 border-orange-200',
  }[slot.status]

  return (
    <div className={`flex items-start gap-3 p-3 rounded-md border ${rowBg}`}>
      <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm truncate" title={slot.file.name}>
            {slot.file.name}
          </span>
          <span className="text-xs text-muted-foreground">
            ({(slot.file.size / 1024).toFixed(1)} KB)
          </span>
        </div>
        {slot.tableLabel ? (
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{slot.tableLabel}</span>
            {slot.matchConfidence >= 99 && (
              <Badge variant="outline" className="text-[10px] border-green-300 text-green-800">
                Match exact
              </Badge>
            )}
            {slot.matchConfidence > 0 && slot.matchConfidence < 99 && (
              <Badge
                variant="outline"
                className="text-[10px] border-yellow-300 text-yellow-800"
                title={slot.matchReason}
              >
                Heuristique · confiance {slot.matchConfidence}
              </Badge>
            )}
          </div>
        ) : slot.status === 'unmatched' ? (
          <p className="text-xs text-orange-700 mt-1">
            ⚠ Aucune table connue pour ce fichier — mapping <code className="bg-orange-100 dark:bg-orange-900/30 px-1 rounded">exportName</code> à ajouter dans le seed
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Auto-détection en cours…</p>
        )}
        {slot.status === 'done' && slot.result && (
          <p className="text-xs text-green-700 mt-1">
            ✓ {slot.result.inserted} insérées, {slot.result.updated} mises à jour,{' '}
            {slot.result.unchanged} inchangées
            {slot.result.errors.length > 0 && (
              <span className="text-red-600"> · {slot.result.errors.length} erreurs</span>
            )}
          </p>
        )}
        {slot.status === 'error' && (
          <p className="text-xs text-red-700 mt-1">✗ {slot.errorMessage}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusIcon className={`w-4 h-4 ${statusColor}`} />
        {(slot.status === 'pending' || slot.status === 'unmatched') && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground"
            title="Retirer de la file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
