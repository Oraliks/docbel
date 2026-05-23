'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Download,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-dialog'

interface BareFile {
  id: string
  name: string
  status: string
  effectiveDate: string
  validFrom: string | null
  uploadedAt: string
  publishedAt: string | null
  multiplicateur: number | null
  isLegacy: boolean
  sheetsCount: number
  amountsCount: number
}

type SortKey = 'name' | 'status' | 'validFrom' | 'uploadedAt' | 'amountsCount'
type SortDir = 'asc' | 'desc'

const STATUS_INFO: Record<string, { label: string; tone: string; order: number }> = {
  draft: { label: 'Brouillon', tone: 'bg-yellow-100 text-yellow-900 border-yellow-300', order: 0 },
  published: { label: 'Publié', tone: 'bg-green-100 text-green-900 border-green-300', order: 1 },
  archived: { label: 'Archivé', tone: 'bg-muted text-muted-foreground', order: 3 },
  rejected: { label: 'Rejeté', tone: 'bg-red-100 text-red-900 border-red-300', order: 4 },
  active: { label: 'Legacy', tone: 'bg-blue-100 text-blue-900 border-blue-300', order: 2 },
}

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, tone: 'bg-muted', order: 99 }
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${info.tone}`}>
      {info.label}
    </span>
  )
}

export default function BaremesAdminPage() {
  const confirm = useConfirm()
  const [files, setFiles] = useState<BareFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('uploadedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/baremes')
      const data = await res.json()
      setFiles(data.files ?? [])
    } catch (err) {
      console.error(err)
      toast.error('Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const f of files) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1
    }
    const totalAmounts = files.reduce((sum, f) => sum + (f.amountsCount ?? 0), 0)
    return { byStatus, totalAmounts, total: files.length }
  }, [files])

  const filtered = useMemo(() => {
    let result = files
    if (statusFilter !== 'all') {
      result = result.filter((f) => f.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((f) => f.name.toLowerCase().includes(q))
    }
    const sorted = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'status':
          cmp =
            (STATUS_INFO[a.status]?.order ?? 99) -
            (STATUS_INFO[b.status]?.order ?? 99)
          break
        case 'validFrom':
          cmp =
            (a.validFrom ? new Date(a.validFrom).getTime() : 0) -
            (b.validFrom ? new Date(b.validFrom).getTime() : 0)
          break
        case 'uploadedAt':
          cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
          break
        case 'amountsCount':
          cmp = a.amountsCount - b.amountsCount
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [files, search, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc')
    }
  }

  const handlePublish = async (id: string, hasErrors: boolean) => {
    const ok = await confirm({
      title: hasErrors ? 'Publier malgré les alertes d’erreur ?' : 'Publier cet import ?',
      description: hasErrors
        ? 'Des erreurs ont été détectées dans la dernière analyse. La publication forcée passera outre — assure-toi d’avoir vérifié manuellement.'
        : 'La version actuellement publiée sera archivée et remplacée par celle-ci.',
      confirmText: hasErrors ? 'Publier quand même' : 'Publier',
      destructive: hasErrors,
    })
    if (!ok) return
    setActing(id)
    try {
      const res = await fetch(`/api/baremes/import/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: hasErrors }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Échec')
      toast.success('Import publié')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (id: string) => {
    const ok = await confirm({
      title: 'Rejeter cet import ?',
      description: 'Il sera marqué "rejeté" et ne pourra plus être publié. Tu pourras toujours réuploader le fichier.',
      confirmText: 'Rejeter',
      destructive: true,
    })
    if (!ok) return
    setActing(id)
    try {
      const res = await fetch(`/api/baremes/import/${id}/reject`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Échec')
      toast.success('Import rejeté')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (id: string) => {
    const file = files.find((f) => f.id === id)
    const fileName = file?.name ?? id.slice(0, 8)
    const ok = await confirm({
      title: `Supprimer le fichier "${fileName}" ?`,
      description:
        "Le BaremeFile et tous ses BaremeAmount associés seront effacés définitivement. Si le fichier est actif, les montants publics rendus depuis cette source ne seront plus résolvables.",
      confirmText: 'Supprimer définitivement',
      destructive: true,
      requireText: fileName,
    })
    if (!ok) return
    setActing(id)
    try {
      const res = await fetch(`/api/baremes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Échec suppression')
      toast.success('Fichier supprimé')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Barèmes officiels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workflow d’import : upload .xlsx → brouillon → validation → publication versionnée.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/baremes/mappings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Mappings d&apos;onglets
          </Link>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Link href="/admin/baremes/import">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel import
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total fichiers" value={counts.total} />
        <KpiCard
          label="Brouillons"
          value={counts.byStatus.draft ?? 0}
          tone={counts.byStatus.draft ? 'warn' : 'muted'}
          onClick={() => setStatusFilter('draft')}
        />
        <KpiCard
          label="Publiés"
          value={counts.byStatus.published ?? 0}
          tone="success"
          onClick={() => setStatusFilter('published')}
        />
        <KpiCard
          label="Archivés"
          value={counts.byStatus.archived ?? 0}
          tone="muted"
          onClick={() => setStatusFilter('archived')}
        />
        <KpiCard
          label="Legacy"
          value={counts.byStatus.active ?? 0}
          tone="info"
          onClick={() => setStatusFilter('active')}
        />
        <KpiCard label="Montants extraits" value={counts.totalAmounts} tone="primary" />
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom de fichier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="published">Publiés</SelectItem>
              <SelectItem value="archived">Archivés</SelectItem>
              <SelectItem value="rejected">Rejetés</SelectItem>
              <SelectItem value="active">Legacy</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== 'all' || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
            >
              Réinitialiser
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {filtered.length} / {files.length} fichiers
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Fichier" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
              <SortHead label="Statut" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              <SortHead
                label="Valide à partir du"
                active={sortKey === 'validFrom'}
                dir={sortDir}
                onClick={() => toggleSort('validFrom')}
              />
              <SortHead
                label="Montants"
                active={sortKey === 'amountsCount'}
                dir={sortDir}
                onClick={() => toggleSort('amountsCount')}
                align="right"
              />
              <TableHead>Feuilles</TableHead>
              <TableHead>Mult.</TableHead>
              <SortHead
                label="Uploadé"
                active={sortKey === 'uploadedAt'}
                dir={sortDir}
                onClick={() => toggleSort('uploadedAt')}
              />
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <p className="text-muted-foreground mb-3">Aucun fichier ne correspond.</p>
                  {files.length === 0 && (
                    <Link href="/admin/baremes/import">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Faire le premier import
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((f) => (
                <TableRow key={f.id} className={acting === f.id ? 'opacity-60' : ''}>
                  <TableCell className="font-medium max-w-[400px] truncate" title={f.name}>
                    <Link href={`/admin/baremes/import/${f.id}`} className="hover:underline">
                      {f.name}
                    </Link>
                    {f.isLegacy && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Sans hash — uploadé avant le nouveau workflow
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.validFrom
                      ? new Date(f.validFrom).toLocaleDateString('fr-BE')
                      : f.effectiveDate || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {f.amountsCount > 0 ? f.amountsCount.toLocaleString('fr-BE') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {f.sheetsCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.multiplicateur ? `×${f.multiplicateur.toFixed(4)}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(f.uploadedAt).toLocaleDateString('fr-BE')}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      file={f}
                      acting={acting === f.id}
                      onPublish={() => handlePublish(f.id, false)}
                      onReject={() => handleReject(f.id)}
                      onDelete={() => handleDelete(f.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone = 'default',
  onClick,
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'muted' | 'primary' | 'warn' | 'info' | 'error'
  onClick?: () => void
}) {
  const toneClass: Record<typeof tone, string> = {
    default: 'border-border',
    success: 'border-green-300 bg-green-50/40 dark:bg-green-950/10',
    muted: 'border-border bg-muted/30',
    primary: 'border-primary/30 bg-primary/5',
    warn: 'border-yellow-300 bg-yellow-50/40 dark:bg-yellow-950/10',
    info: 'border-blue-300 bg-blue-50/40 dark:bg-blue-950/10',
    error: 'border-red-300 bg-red-50/40 dark:bg-red-950/10',
  }
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition ${toneClass[tone]} ${
        onClick ? 'hover:border-primary cursor-pointer' : ''
      }`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Comp>
  )
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
}) {
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          active ? 'text-foreground font-medium' : ''
        }`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        {active && <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </TableHead>
  )
}

function RowActions({
  file,
  acting,
  onPublish,
  onReject,
  onDelete,
}: {
  file: BareFile
  acting: boolean
  onPublish: () => void
  onReject: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" disabled={acting} className="h-8 w-8 p-0">
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only">Actions</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/admin/baremes/import/${file.id}`} />}>
          <Eye className="w-4 h-4 mr-2" />
          Voir les détails
        </DropdownMenuItem>
        {file.status === 'draft' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPublish}>
              <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
              Publier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onReject}>
              <XCircle className="w-4 h-4 mr-2 text-red-600" />
              Rejeter
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <a href={`/api/baremes?fileId=${file.id}`} target="_blank" rel="noreferrer" />
          }
        >
          <Download className="w-4 h-4 mr-2" />
          Télécharger JSON
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
