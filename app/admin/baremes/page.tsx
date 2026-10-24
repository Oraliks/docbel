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
  XCircle,
  Trash2,
  Download,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate, formatNumber } from '@/lib/i18n/format'
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

const STATUS_INFO: Record<string, { tone: string; order: number }> = {
  draft: { tone: 'bg-yellow-100 text-yellow-900 border-yellow-300', order: 0 },
  published: { tone: 'bg-green-100 text-green-900 border-green-300', order: 1 },
  archived: { tone: 'bg-muted text-muted-foreground', order: 3 },
  revoked: { tone: 'bg-muted text-muted-foreground', order: 4 },
  rejected: { tone: 'bg-red-100 text-red-900 border-red-300', order: 4 },
  active: { tone: 'bg-blue-100 text-blue-900 border-blue-300', order: 2 },
}

const STATUS_LABEL_KEY: Record<string, string> = {
  deleting: 'statusDeleting',
  draft: 'statusDraft',
  published: 'statusPublished',
  archived: 'statusArchived',
  revoked: 'statusRevoked',
  rejected: 'statusRejected',
  active: 'statusLegacy',
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('admin.baremes')
  const info = STATUS_INFO[status] ?? { tone: 'bg-muted', order: 99 }
  const labelKey = STATUS_LABEL_KEY[status]
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${info.tone}`}>
      {labelKey ? t(labelKey as Parameters<typeof t>[0]) : status}
    </span>
  )
}

export default function BaremesAdminPage() {
  const t = useTranslations('admin.baremes')
  const locale = useLocale()
  const confirm = useConfirm()
  const [files, setFiles] = useState<BareFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('uploadedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [acting, setActing] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalFiles, setTotalFiles] = useState(0)

  const load = useCallback(async (append = false, cursor?: string | null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      if (append && cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/baremes?${params}`)
      const data = await res.json()
      setFiles((previous) => (append ? [...previous, ...(data.files ?? [])] : (data.files ?? [])))
      setNextCursor(data.nextCursor ?? null)
      setTotalFiles(data.total ?? 0)
    } catch (err) {
      console.error(err)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false)
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
    const result = files
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
  }, [files, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc')
    }
  }

  const handleReject = async (id: string) => {
    const ok = await confirm({
      title: t('rejectConfirmTitle'),
      description: t('rejectConfirmDescription'),
      confirmText: t('reject'),
      destructive: true,
    })
    if (!ok) return
    setActing(id)
    try {
      const res = await fetch(`/api/baremes/import/${id}/reject`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? t('failed'))
      toast.success(t('rejectSuccess'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (id: string) => {
    const file = files.find((f) => f.id === id)
    const fileName = file?.name ?? id.slice(0, 8)
    const ok = await confirm({
      title: t('deleteConfirmTitle', { name: fileName }),
      description: t('deleteConfirmDescription'),
      confirmText: t('deleteConfirm'),
      destructive: true,
      requireText: fileName,
    })
    if (!ok) return
    setActing(id)
    try {
      const res = await fetch(`/api/baremes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        await load()
        throw new Error(body.error ?? t('deleteFailed'))
      }
      toast.success(t('deleteSuccess'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/baremes/mappings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('sheetMappings')}
          </Link>
          <Button variant="outline" onClick={() => load(false)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
          <Link href="/admin/baremes/import">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t('newImport')}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3" aria-label={t('overviewSections')}>
        <OverviewSection title={t('overviewPublished')} files={files.filter((file) => file.status === 'published')} empty={t('overviewPublishedEmpty')} />
        <OverviewSection title={t('overviewDrafts')} files={files.filter((file) => file.status === 'draft' || file.status === 'pending_approval')} empty={t('overviewDraftsEmpty')} />
        <OverviewSection title={t('overviewHistory')} files={files.filter((file) => ['archived', 'revoked', 'rejected'].includes(file.status))} empty={t('overviewHistoryEmpty')} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label={t('kpiTotalFiles')} value={counts.total} />
        <KpiCard
          label={t('kpiDrafts')}
          value={counts.byStatus.draft ?? 0}
          tone={counts.byStatus.draft ? 'warn' : 'muted'}
          onClick={() => setStatusFilter('draft')}
        />
        <KpiCard
          label={t('kpiPublished')}
          value={counts.byStatus.published ?? 0}
          tone="success"
          onClick={() => setStatusFilter('published')}
        />
        <KpiCard
          label={t('kpiArchived')}
          value={counts.byStatus.archived ?? 0}
          tone="muted"
          onClick={() => setStatusFilter('archived')}
        />
        <KpiCard
          label={t('kpiLegacy')}
          value={counts.byStatus.active ?? 0}
          tone="info"
          onClick={() => setStatusFilter('active')}
        />
        <KpiCard label={t('kpiAmountsExtracted')} value={counts.totalAmounts} tone="primary" />
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t('filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('statusAll')}</SelectItem>
              <SelectItem value="draft">{t('kpiDrafts')}</SelectItem>
              <SelectItem value="published">{t('kpiPublished')}</SelectItem>
              <SelectItem value="archived">{t('kpiArchived')}</SelectItem>
              <SelectItem value="revoked">{t('statusRevoked')}</SelectItem>
              <SelectItem value="rejected">{t('statusRejectedPlural')}</SelectItem>
              <SelectItem value="active">{t('kpiLegacy')}</SelectItem>
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
              {t('reset')}
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {t('fileCount', { shown: filtered.length, total: totalFiles })}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label={t('colFile')} active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
              <SortHead label={t('colStatus')} active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
              <SortHead
                label={t('colValidFrom')}
                active={sortKey === 'validFrom'}
                dir={sortDir}
                onClick={() => toggleSort('validFrom')}
              />
              <SortHead
                label={t('colAmounts')}
                active={sortKey === 'amountsCount'}
                dir={sortDir}
                onClick={() => toggleSort('amountsCount')}
                align="right"
              />
              <TableHead>{t('colSheets')}</TableHead>
              <TableHead>{t('colMultiplier')}</TableHead>
              <SortHead
                label={t('colUploaded')}
                active={sortKey === 'uploadedAt'}
                dir={sortDir}
                onClick={() => toggleSort('uploadedAt')}
              />
              <TableHead className="w-12 text-right">{t('colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {t('loading')}
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <p className="text-muted-foreground mb-3">{t('noFilesMatch')}</p>
                  {files.length === 0 && (
                    <Link href="/admin/baremes/import">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('firstImport')}
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
                        {t('legacyHint')}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={f.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {f.validFrom
                      ? formatDate(f.validFrom, locale)
                      : f.effectiveDate || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {f.amountsCount > 0 ? formatNumber(f.amountsCount, locale) : '—'}
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
                    {formatDate(f.uploadedAt, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      file={f}
                      acting={acting === f.id}
                      onReject={() => handleReject(f.id)}
                      onDelete={() => handleDelete(f.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => load(true, nextCursor)} disabled={loading}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  )
}

function OverviewSection({ title, files, empty }: { title: string; files: BareFile[]; empty: string }) {
  const locale = useLocale()
  return <Card><CardContent className="p-4 space-y-3">
    <h2 className="font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({formatNumber(files.length, locale)})</span></h2>
    {files.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="space-y-2">{files.slice(0, 4).map((file) => <li key={file.id} className="border-t pt-2 first:border-0 first:pt-0">
      <Link href={`/admin/baremes/import/${file.id}`} className="font-medium text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{file.name}</Link>
      <p className="text-xs text-muted-foreground">{file.validFrom ? formatDate(file.validFrom, locale) : file.effectiveDate} · {formatDate(file.uploadedAt, locale)}</p>
    </li>)}</ul>}
  </CardContent></Card>
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
  const locale = useLocale()
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
      <div className="text-2xl font-semibold tabular-nums">{formatNumber(value, locale)}</div>
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
  onReject,
  onDelete,
}: {
  file: BareFile
  acting: boolean
  onReject: () => void
  onDelete: () => void
}) {
  const t = useTranslations('admin.baremes')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" disabled={acting} className="h-8 w-8 p-0">
            <MoreHorizontal className="w-4 h-4" />
            <span className="sr-only">{t('colActions')}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/admin/baremes/import/${file.id}`} />}>
          <Eye className="w-4 h-4 mr-2" />
          {t('viewDetails')}
        </DropdownMenuItem>
        {file.status === 'draft' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReject}>
              <XCircle className="w-4 h-4 mr-2 text-red-600" />
              {t('reject')}
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
          {t('downloadJson')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-red-600 focus:text-red-700"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
