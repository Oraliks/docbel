'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  Upload,
  Search,
  ExternalLink,
  Loader2,
  RefreshCw,
  Pencil,
  Check,
  X,
  StickyNote,
} from 'lucide-react'
import { toast } from 'sonner'

interface LookupTableData {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  group: string | null
  sourcePath: string | null
  entriesCount: number
  lastImportedAt: string | null
  lastImportedBy: string | null
  lastImportSource: string | null
  notes: string | null
  requiresApproval: boolean
  category: { slug: string; labelFr: string; labelNl: string }
}

interface LookupEntryData {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  notes: string | null
  validFrom: string | null
  validUntil: string | null
}

type LangCode = 'fr' | 'nl' | 'de' | 'en'

export default function LookupTableDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [table, setTable] = useState<LookupTableData | null>(null)
  const [entries, setEntries] = useState<LookupEntryData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [includeAll, setIncludeAll] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [displayLang, setDisplayLang] = useState<LangCode>('fr')
  const [editingTable, setEditingTable] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const usp = new URLSearchParams()
      if (search.trim()) usp.set('q', search.trim())
      if (includeAll) usp.set('includeAll', 'true')
      usp.set('limit', '200')
      const res = await fetch(`/api/lookup/tables/${id}?${usp.toString()}`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data = await res.json()
      setTable(data.table)
      setEntries(data.entries ?? [])
      setTotal(data.pagination?.total ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [id, search, includeAll])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const handleUpload = async (file: File | null) => {
    if (!file || !id) return
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error('Format attendu : .csv ou .txt')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/lookup/tables/${id}/import`, {
        method: 'POST',
        body: formData,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Import échoué')
      toast.success(
        `Import : ${body.inserted} insérées, ${body.updated} mises à jour, ${body.unchanged} inchangées${body.errors?.length ? `, ${body.errors.length} erreurs` : ''}`
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setUploading(false)
    }
  }

  const saveTableEdit = async (patch: Partial<LookupTableData>) => {
    if (!id) return
    try {
      const res = await fetch(`/api/lookup/tables/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Échec sauvegarde')
      }
      toast.success('Table mise à jour')
      setEditingTable(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const saveEntry = async (entryId: string, patch: Partial<LookupEntryData>) => {
    try {
      const res = await fetch(`/api/lookup/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Échec sauvegarde')
      }
      // Mise à jour optimiste locale
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, ...patch } : e))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
      throw err
    }
  }

  if (loading && !table) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (!table) {
    return (
      <div className="p-6">
        <Link
          href="/admin/chomage/lookup"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Lookup
        </Link>
        <p className="mt-6">Table introuvable.</p>
      </div>
    )
  }

  const sourceHref = table.sourcePath
    ? `https://services.onem.be${table.sourcePath}`
    : 'https://services.onem.be/lookupweb/'

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <Link
            href="/admin/chomage/lookup"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Toutes les tables
          </Link>
          <TableHeaderEdit
            table={table}
            editing={editingTable}
            onEdit={() => setEditingTable(true)}
            onCancel={() => setEditingTable(false)}
            onSave={saveTableEdit}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <LanguageSwitcher value={displayLang} onChange={setDisplayLang} />
          <Button
            variant="outline"
            size="sm"
            render={<a href={sourceHref} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-2" />
            Source ONEM
          </Button>
          <Button variant="outline" onClick={load} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <label className="inline-block cursor-pointer">
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0] ?? null
                void handleUpload(f)
                e.currentTarget.value = ''
              }}
            />
            <Button type="button" size="sm" disabled={uploading} render={<span />}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Import…' : 'Importer CSV'}
            </Button>
          </label>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Code, libellé FR ou NL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeAll}
              onChange={(e) => setIncludeAll(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Inclure les entrées expirées
          </label>
          <div className="ml-auto text-sm text-muted-foreground">
            {entries.length} affichées / {total.toLocaleString('fr-BE')} total
          </div>
        </CardContent>
      </Card>

      {table.entriesCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucune entrée dans cette table.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              <strong>Étapes :</strong> ouvre la source ONEM ci-dessus, exporte la table en CSV
              (bouton « Exporter » en bas), puis upload le fichier ici via « Importer CSV ».
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Entrées ({total.toLocaleString('fr-BE')}) — clique sur une cellule pour éditer
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>FR</TableHead>
                  <TableHead>NL</TableHead>
                  <TableHead>DE</TableHead>
                  <TableHead>EN</TableHead>
                  <TableHead className="w-10">Notes</TableHead>
                  <TableHead className="w-24">Valide depuis</TableHead>
                  <TableHead className="w-24">Jusqu&apos;au</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} onSave={saveEntry} displayLang={displayLang} />
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Aucune entrée ne correspond.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TableHeaderEdit({
  table,
  editing,
  onEdit,
  onCancel,
  onSave,
}: {
  table: LookupTableData
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (patch: Partial<LookupTableData>) => Promise<void>
}) {
  const [labelFr, setLabelFr] = useState(table.labelFr)
  const [labelNl, setLabelNl] = useState(table.labelNl)
  const [notes, setNotes] = useState(table.notes ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabelFr(table.labelFr)
    setLabelNl(table.labelNl)
    setNotes(table.notes ?? '')
  }, [table])

  if (editing) {
    return (
      <div className="space-y-2 max-w-2xl">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">{table.prefix}</Badge>
          <Input value={labelFr} onChange={(e) => setLabelFr(e.target.value)} placeholder="Label FR" className="flex-1" />
        </div>
        <Input value={labelNl} onChange={(e) => setLabelNl(e.target.value)} placeholder="Label NL" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes admin (interne)" />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              onSave({
                labelFr,
                labelNl,
                notes: notes || null,
              })
            }
          >
            <Check className="w-4 h-4 mr-1" />
            Sauver
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Annuler
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="font-mono">
          {table.prefix}
        </Badge>
        <h1 className="text-xl font-bold truncate">{table.labelFr}</h1>
        <button
          onClick={onEdit}
          className="text-muted-foreground hover:text-foreground"
          title="Éditer le label de la table"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {table.requiresApproval && (
          <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-800">
            4 yeux requis
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
        <span>{table.category.labelFr}</span>
        {table.group && <span>· {table.group}</span>}
        <span>· {table.labelNl}</span>
        {table.lastImportedAt ? (
          <span>
            · MAJ {new Date(table.lastImportedAt).toLocaleDateString('fr-BE')}
            {table.lastImportedBy && ` par ${table.lastImportedBy}`}
          </span>
        ) : (
          <span className="italic">· Jamais importée</span>
        )}
      </div>
      {table.notes && (
        <p className="text-xs text-muted-foreground italic mt-1 flex items-start gap-1">
          <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
          {table.notes}
        </p>
      )}
    </div>
  )
}

function LanguageSwitcher({
  value,
  onChange,
}: {
  value: LangCode
  onChange: (v: LangCode) => void
}) {
  const langs: LangCode[] = ['fr', 'nl', 'de', 'en']
  return (
    <div className="inline-flex rounded-md border overflow-hidden">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-2 py-1 text-[10px] uppercase font-medium ${
            value === l
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-muted'
          }`}
          title={`Mettre en évidence la colonne ${l.toUpperCase()}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function EntryRow({
  entry,
  onSave,
  displayLang,
}: {
  entry: LookupEntryData
  onSave: (id: string, patch: Partial<LookupEntryData>) => Promise<void>
  displayLang: LangCode
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs align-top py-2">{entry.code}</TableCell>
      <EditableCell
        entry={entry}
        field="labelFr"
        value={entry.labelFr}
        onSave={onSave}
        highlight={displayLang === 'fr'}
      />
      <EditableCell
        entry={entry}
        field="labelNl"
        value={entry.labelNl}
        onSave={onSave}
        highlight={displayLang === 'nl'}
      />
      <EditableCell
        entry={entry}
        field="labelDe"
        value={entry.labelDe ?? ''}
        onSave={onSave}
        nullable
        highlight={displayLang === 'de'}
      />
      <EditableCell
        entry={entry}
        field="labelEn"
        value={entry.labelEn ?? ''}
        onSave={onSave}
        nullable
        highlight={displayLang === 'en'}
      />
      <NotesCell entry={entry} onSave={onSave} />
      <TableCell className="text-xs text-muted-foreground align-top py-2">
        {entry.validFrom ? new Date(entry.validFrom).toLocaleDateString('fr-BE') : '—'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground align-top py-2">
        {entry.validUntil ? (
          <span className="text-orange-700">
            {new Date(entry.validUntil).toLocaleDateString('fr-BE')}
          </span>
        ) : (
          <span className="text-green-700">en vigueur</span>
        )}
      </TableCell>
    </TableRow>
  )
}

function EditableCell({
  entry,
  field,
  value,
  onSave,
  nullable = false,
  highlight = false,
}: {
  entry: LookupEntryData
  field: 'labelFr' | 'labelNl' | 'labelDe' | 'labelEn'
  value: string
  onSave: (id: string, patch: Partial<LookupEntryData>) => Promise<void>
  nullable?: boolean
  highlight?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    try {
      const payload = nullable && !draft.trim() ? null : draft
      await onSave(entry.id, { [field]: payload as never })
      setEditing(false)
    } catch {
      setDraft(value)
    }
  }

  const cellClass = `text-sm align-top py-2 cursor-text ${
    highlight ? 'bg-primary/5' : ''
  }`

  if (editing) {
    return (
      <TableCell className={cellClass}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            else if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className="w-full bg-transparent border border-primary rounded px-1 py-0.5 text-sm"
        />
      </TableCell>
    )
  }

  const displayValue = value || (nullable ? <span className="text-muted-foreground italic">vide</span> : '—')

  return (
    <TableCell className={cellClass} onClick={() => setEditing(true)}>
      <span className="block hover:bg-muted/50 rounded px-1 -mx-1">{displayValue}</span>
    </TableCell>
  )
}

function NotesCell({
  entry,
  onSave,
}: {
  entry: LookupEntryData
  onSave: (id: string, patch: Partial<LookupEntryData>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.notes ?? '')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(entry.notes ?? '')
  }, [entry.notes])

  const commit = async () => {
    const newVal = draft.trim() || null
    if (newVal === entry.notes) {
      setEditing(false)
      return
    }
    try {
      await onSave(entry.id, { notes: newVal })
      setEditing(false)
    } catch {
      setDraft(entry.notes ?? '')
    }
  }

  if (editing) {
    return (
      <TableCell className="align-top py-2">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(entry.notes ?? '')
              setEditing(false)
            }
          }}
          rows={2}
          className="w-44 bg-transparent border border-primary rounded px-1 py-0.5 text-xs"
        />
      </TableCell>
    )
  }

  return (
    <TableCell className="align-top py-2 text-center">
      <button
        onClick={() => setEditing(true)}
        className={`p-1 rounded hover:bg-muted ${entry.notes ? 'text-yellow-600' : 'text-muted-foreground/40'}`}
        title={entry.notes || 'Ajouter une note interne'}
      >
        <StickyNote className="w-4 h-4" />
      </button>
    </TableCell>
  )
}
