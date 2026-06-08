'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Calendar,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface FileRecord {
  id: string
  name: string
  status: string
  filePath: string
  fileHash: string | null
  effectiveDate: string
  validFrom: string | null
  multiplicateur: number | null
  publishedAt: string | null
  publishedBy: string | null
  createdBy: string | null
  createdAt: string
  summary: {
    sheetsDetected: number
    sheetsParsed: number
    sheetsIgnored: number
    amountsExtracted: number
    sheetsByName: { name: string; parsed: boolean; amountsCount: number; reason?: string }[]
  } | null
  alerts:
    | {
        level: 'info' | 'warn' | 'error'
        sheet?: string
        cell?: string
        message: string
      }[]
    | null
}

interface AmountPreview {
  id: string
  sourceSheet: string
  category: string
  allocationCode: string | null
  salaryCode: string | null
  article: string | null
  labelFr: string | null
  labelNl: string | null
  unit: string | null
  amount: number
  minDailySalary: number | null
  maxDailySalary: number | null
  comparisonKey: string
}

interface DiffChange {
  type: 'amount_changed' | 'new_entry' | 'removed_entry'
  key: string
  oldValue?: number
  newValue?: number
  category: string
  sourceSheet?: string
}

interface Diff {
  changes: DiffChange[]
  previousFileId: string | null
  newFileId: string
  countsByType: {
    amount_changed: number
    new_entry: number
    removed_entry: number
  }
}

interface Approval {
  id: string
  approverEmail: string
  approverName: string | null
  comment: string | null
  createdAt: string
}

interface HistoryEntry {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  actorEmail: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

interface PreviewData {
  file: FileRecord & { requiresApproval?: boolean }
  amountsPreview: AmountPreview[]
  totalAmounts: number
  amountsPreviewLimit: number
  diff: Diff | null
  history?: HistoryEntry[]
  approvals?: Approval[]
}

export default function BaremeImportPreviewPage() {
  const t = useTranslations('admin.baremes')
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t('loadError'))
      }
      setData(await res.json())
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const publish = async (force = false) => {
    if (!id) return
    if (
      !confirm(
        force
          ? t('previewPublishForceConfirm')
          : t('previewPublishConfirm')
      )
    )
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('previewPublishFailed'))
      toast.success(t('publishSuccess'))
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error')
      toast.error(message)
    } finally {
      setActing(false)
    }
  }

  const reject = async () => {
    if (!id) return
    if (!confirm(t('previewRejectConfirm')))
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/reject`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('previewRejectFailed'))
      toast.success(t('rejectSuccess'))
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error')
      toast.error(message)
    } finally {
      setActing(false)
    }
  }

  const approve = async () => {
    if (!id) return
    const comment = window.prompt(t('approvePrompt')) ?? ''
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        toast.info(t('alreadyApproved'))
        return
      }
      if (!res.ok) throw new Error(body.error ?? t('approveFailed'))
      if (body.autoPublished) {
        toast.success(t('approveAutoPublished', { count: body.approvalsCount, required: body.requiredCount }))
      } else {
        toast.success(t('approveRecorded', { count: body.approvalsCount, required: body.requiredCount }))
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setActing(false)
    }
  }

  const rollback = async () => {
    if (!id) return
    if (
      !confirm(
        t('rollbackConfirm')
      )
    )
      return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/rollback`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('rollbackFailed'))
      toast.success(t('rollbackSuccess'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t('loading')}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <Link
          href="/admin/baremes"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('title')}
        </Link>
        <p className="mt-6">{t('previewNotFound')}</p>
      </div>
    )
  }

  const { file, amountsPreview, totalAmounts, amountsPreviewLimit, diff } = data
  const alerts = file.alerts ?? []
  const summary = file.summary
  const isDraftOrPending = file.status === 'draft' || file.status === 'pending_approval'
  const isArchived = file.status === 'archived'
  const requiresApproval = file.requiresApproval === true
  const approvals = data.approvals ?? []
  const history = data.history ?? []
  const errorCount = alerts.filter((a) => a.level === 'error').length
  const warnCount = alerts.filter((a) => a.level === 'warn').length
  const infoCount = alerts.filter((a) => a.level === 'info').length

  const statusLabel: Record<string, { label: string; tone: string }> = {
    draft: { label: t('statusDraft'), tone: 'bg-yellow-100 text-yellow-900 border-yellow-200' },
    pending_approval: {
      label: t('statusPendingApproval'),
      tone: 'bg-orange-100 text-orange-900 border-orange-300',
    },
    published: { label: t('statusPublished'), tone: 'bg-green-100 text-green-900 border-green-200' },
    archived: { label: t('statusArchived'), tone: 'bg-muted text-muted-foreground' },
    rejected: { label: t('statusRejected'), tone: 'bg-red-100 text-red-900 border-red-200' },
    active: { label: t('statusLegacyLong'), tone: 'bg-muted text-muted-foreground' },
  }
  const statusInfo = statusLabel[file.status] ?? { label: file.status, tone: 'bg-muted' }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header sticky avec actions */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <Link
              href="/admin/baremes"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-3 h-3" />
              {t('title')}
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
              <h1 className="text-xl font-bold truncate" title={file.name}>
                {file.name}
              </h1>
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${statusInfo.tone}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {file.validFrom
                  ? t('validSince', { date: new Date(file.validFrom).toLocaleDateString('fr-BE') })
                  : t('rawDate', { date: file.effectiveDate })}
              </span>
              {file.multiplicateur && <span>×{file.multiplicateur.toFixed(4)}</span>}
              <span className="font-mono">
                {t('hashLabel', { hash: file.fileHash ? file.fileHash.slice(0, 10) + '…' : t('hashLegacy') })}
              </span>
              {file.createdBy && <span>{t('byActor', { actor: file.createdBy })}</span>}
              {file.publishedAt && (
                <span>{t('publishedOn', { date: new Date(file.publishedAt).toLocaleDateString('fr-BE') })}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {file.filePath && (
              <Button
                variant="outline"
                onClick={() => window.open(file.filePath, '_blank')}
                type="button"
                size="sm"
              >
                {t('sourceXlsx')}
              </Button>
            )}
            {isDraftOrPending && (
              <>
                <Button
                  variant="outline"
                  onClick={() => reject()}
                  disabled={acting}
                  className="text-red-600 hover:text-red-700"
                  size="sm"
                >
                  {t('reject')}
                </Button>
                {requiresApproval ? (
                  <Button onClick={approve} disabled={acting} size="sm">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {t('approveWithCount', { count: approvals.length })}
                  </Button>
                ) : errorCount > 0 ? (
                  <Button onClick={() => publish(true)} disabled={acting} variant="outline" size="sm">
                    {t('publishWithErrors', { count: errorCount })}
                  </Button>
                ) : (
                  <Button onClick={() => publish(false)} disabled={acting} size="sm">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {t('publish')}
                  </Button>
                )}
              </>
            )}
            {isArchived && (
              <Button onClick={rollback} disabled={acting} variant="outline" size="sm">
                {t('restoreVersion')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid — pleine largeur */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label={t('statSheetsDetected')} value={summary.sheetsDetected} />
          <Stat label={t('statSheetsParsed')} value={summary.sheetsParsed} tone="success" />
          <Stat label={t('statSheetsIgnored')} value={summary.sheetsIgnored} tone="muted" />
          <Stat label={t('kpiAmountsExtracted')} value={summary.amountsExtracted} tone="primary" />
          <Stat label={t('statErrors')} value={errorCount} tone={errorCount > 0 ? 'error' : 'muted'} />
          <Stat label={t('statWarnings')} value={warnCount} tone={warnCount > 0 ? 'warn' : 'muted'} />
        </div>
      )}

      <Tabs defaultValue="diff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="diff">
            {t('tabChanges')}
            {diff && diff.changes.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {diff.changes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            {t('tabAlerts')}
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sheets">{t('tabSheets')}</TabsTrigger>
          <TabsTrigger value="preview">
            {t('tabAmountsPreview')}
            <Badge variant="secondary" className="ml-2">
              {totalAmounts}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="raw">{t('tabRawGrid')}</TabsTrigger>
          <TabsTrigger value="workflow">
            {t('tabWorkflow')}
            {(approvals.length > 0 || history.length > 0) && (
              <Badge variant="secondary" className="ml-2">
                {approvals.length + history.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diff">
          <DiffPanel diff={diff} status={file.status} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsPanel alerts={alerts} counts={{ error: errorCount, warn: warnCount, info: infoCount }} />
        </TabsContent>

        <TabsContent value="sheets">
          <SheetsPanel sheets={summary?.sheetsByName ?? []} />
        </TabsContent>

        <TabsContent value="preview">
          <AmountsPreviewPanel
            amounts={amountsPreview}
            total={totalAmounts}
            limit={amountsPreviewLimit}
          />
        </TabsContent>

        <TabsContent value="raw">
          <RawSheetsPanel fileId={file.id} />
        </TabsContent>

        <TabsContent value="workflow">
          <WorkflowPanel
            approvals={approvals}
            history={history}
            requiresApproval={requiresApproval}
            status={file.status}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'muted' | 'primary' | 'warn' | 'error'
}) {
  const toneClass: Record<typeof tone, string> = {
    default: 'border-border',
    success: 'border-green-200 bg-green-50 dark:bg-green-950/20',
    muted: 'border-border bg-muted/30',
    primary: 'border-blue-200 bg-blue-50 dark:bg-blue-950/20',
    warn: 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20',
    error: 'border-red-300 bg-red-50 dark:bg-red-950/20',
  }
  return (
    <div className={`rounded-lg border p-3 ${toneClass[tone]}`}>
      <div className="text-2xl font-semibold">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function DiffPanel({ diff, status }: { diff: Diff | null; status: string }) {
  const t = useTranslations('admin.baremes')
  if (status !== 'draft') {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('diffOnlyDrafts')}
        </CardContent>
      </Card>
    )
  }
  if (!diff) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('diffNone')}
        </CardContent>
      </Card>
    )
  }
  if (!diff.previousFileId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('diffNoPrevious')}
        </CardContent>
      </Card>
    )
  }

  const groups = {
    amount_changed: diff.changes.filter((c) => c.type === 'amount_changed'),
    new_entry: diff.changes.filter((c) => c.type === 'new_entry'),
    removed_entry: diff.changes.filter((c) => c.type === 'removed_entry'),
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('diffModified')} value={groups.amount_changed.length} tone="warn" />
        <Stat label={t('diffNew')} value={groups.new_entry.length} tone="success" />
        <Stat label={t('diffRemoved')} value={groups.removed_entry.length} tone="error" />
      </div>

      {groups.amount_changed.length > 0 && (
        <DiffSection title={t('diffSectionModified')} items={groups.amount_changed.slice(0, 100)} />
      )}
      {groups.new_entry.length > 0 && (
        <DiffSection title={t('diffSectionNew')} items={groups.new_entry.slice(0, 100)} />
      )}
      {groups.removed_entry.length > 0 && (
        <DiffSection title={t('diffSectionRemoved')} items={groups.removed_entry.slice(0, 100)} />
      )}

      {diff.changes.length > 300 && (
        <p className="text-xs text-muted-foreground">
          {t('diffLimited')}
        </p>
      )}
    </div>
  )
}

function DiffSection({ title, items }: { title: string; items: DiffChange[] }) {
  const t = useTranslations('admin.baremes')
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">{t('diffColKey')}</th>
                <th className="text-left px-3 py-2">{t('diffColSource')}</th>
                <th className="text-right px-3 py-2">{t('diffColOld')}</th>
                <th className="text-right px-3 py-2">{t('diffColNew')}</th>
                <th className="text-right px-3 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => {
                const oldV = 'oldValue' in c ? c.oldValue : null
                const newV = 'newValue' in c ? c.newValue : null
                const delta = oldV != null && newV != null ? newV - oldV : null
                const deltaPct =
                  oldV != null && oldV !== 0 && delta != null ? (delta / oldV) * 100 : null
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 font-mono text-xs">{c.key}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {c.sourceSheet ?? c.category}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {oldV != null ? oldV.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {newV != null ? newV.toFixed(2) : '—'}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono text-xs ${
                        delta != null && delta > 0
                          ? 'text-green-700 dark:text-green-400'
                          : delta != null && delta < 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {delta != null
                        ? `${delta > 0 ? '+' : ''}${delta.toFixed(2)}${deltaPct != null ? ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)` : ''}`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertsPanel({
  alerts,
  counts,
}: {
  alerts: FileRecord['alerts']
  counts: { error: number; warn: number; info: number }
}) {
  const t = useTranslations('admin.baremes')
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('alertsNone')}
        </CardContent>
      </Card>
    )
  }

  const icons = {
    error: <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
    warn: <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-3">
          <span>
            {counts.error > 0 && (
              <span className="text-red-600 mr-2">{t('alertsErrorCount', { count: counts.error })}</span>
            )}
            {counts.warn > 0 && (
              <span className="text-yellow-600 mr-2">{t('alertsWarnCount', { count: counts.warn })}</span>
            )}
            {counts.info > 0 && <span className="text-blue-600">{t('alertsInfoCount', { count: counts.info })}</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {icons[a.level]}
              <div className="flex-1">
                <div>{a.message}</div>
                {(a.sheet || a.cell) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.sheet && <span>{t('alertSheet', { sheet: a.sheet })}</span>}
                    {a.sheet && a.cell && <span> · </span>}
                    {a.cell && <span>{t('alertCell', { cell: a.cell })}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function SheetsPanel({
  sheets,
}: {
  sheets: { name: string; parsed: boolean; amountsCount: number; reason?: string }[]
}) {
  const t = useTranslations('admin.baremes')
  if (sheets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('sheetsNone')}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">{t('sheetsColSheet')}</th>
              <th className="text-left px-3 py-2">{t('sheetsColStatus')}</th>
              <th className="text-right px-3 py-2">{t('sheetsColAmounts')}</th>
              <th className="text-left px-3 py-2">{t('sheetsColReason')}</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{s.name}</td>
                <td className="px-3 py-2">
                  {s.parsed ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('sheetParsed')}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('sheetIgnored')}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{s.amountsCount}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{s.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function AmountsPreviewPanel({
  amounts,
  total,
  limit,
}: {
  amounts: AmountPreview[]
  total: number
  limit: number
}) {
  const t = useTranslations('admin.baremes')
  if (amounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('amountsNone')}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {t('amountsPreviewHeader', { shown: amounts.length, total: total.toLocaleString('fr-BE') })}
          {total > limit && ` ${t('amountsLimit', { limit })}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">{t('amountsColCategory')}</th>
                <th className="text-left px-3 py-2">{t('amountsColSheet')}</th>
                <th className="text-left px-3 py-2">{t('amountsColAllocCode')}</th>
                <th className="text-left px-3 py-2">{t('amountsColBracket')}</th>
                <th className="text-left px-3 py-2">{t('amountsColArticle')}</th>
                <th className="text-left px-3 py-2">{t('amountsColLabel')}</th>
                <th className="text-right px-3 py-2">{t('amountsColAmount')}</th>
                <th className="text-left px-3 py-2">{t('amountsColUnit')}</th>
              </tr>
            </thead>
            <tbody>
              {amounts.map((a) => (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-1.5 font-mono">{a.category}</td>
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{a.sourceSheet}</td>
                  <td className="px-3 py-1.5 font-mono">{a.allocationCode ?? '—'}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {a.salaryCode ?? '—'}
                    {a.minDailySalary != null && a.maxDailySalary != null && (
                      <span className="text-muted-foreground ml-1">
                        ({a.minDailySalary.toFixed(2)}–{a.maxDailySalary.toFixed(2)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">{a.article ?? '—'}</td>
                  <td className="px-3 py-1.5 truncate max-w-[240px]">
                    {a.labelFr ?? a.labelNl ?? '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{a.amount.toFixed(4)}</td>
                  <td className="px-3 py-1.5">{a.unit ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

interface RawSheetData {
  id: string
  name: string
  category: string
  rowCount: number
  colCount: number
  sheetIndex: number
  cellData: string[][]
}

function RawSheetsPanel({ fileId }: { fileId: string }) {
  const t = useTranslations('admin.baremes')
  const [sheets, setSheets] = useState<RawSheetData[] | null>(null)
  const [activeId, setActiveId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchSheets() {
      setLoading(true)
      try {
        const res = await fetch(`/api/baremes?fileId=${fileId}`)
        if (!res.ok) throw new Error(t('loadError'))
        const data = await res.json()
        if (cancelled) return
        setSheets(data.sheets ?? [])
        if (data.sheets?.[0]) setActiveId(data.sheets[0].id)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : t('error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void fetchSheets()
    return () => {
      cancelled = true
    }
  }, [fileId, t])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          {t('rawLoadingGrids')}
        </CardContent>
      </Card>
    )
  }

  if (!sheets || sheets.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('rawNoSheets')}
        </CardContent>
      </Card>
    )
  }

  const active = sheets.find((s) => s.id === activeId) ?? sheets[0]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('tabRawGrid')}</span>
            <span className="text-xs text-muted-foreground">
              ({t('rawSheetCount', { count: sheets.length })})
            </span>
          </div>
          <div className="relative w-72 max-w-full">
            <input
              type="search"
              placeholder={t('rawFilterCells')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-1.5 bg-background"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={active.id} onValueChange={setActiveId}>
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-auto">
              {sheets.map((sheet) => (
                <TabsTrigger key={sheet.id} value={sheet.id} className="text-xs">
                  {sheet.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {sheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id} className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">
                {sheet.category} · {sheet.rowCount} × {sheet.colCount}
              </div>
              <ExcelGrid cellData={sheet.cellData} searchTerm={searchTerm} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function ExcelGrid({ cellData, searchTerm }: { cellData: string[][]; searchTerm: string }) {
  const t = useTranslations('admin.baremes')
  const search = searchTerm.toLowerCase().trim()

  const highlightCell = (val: string): React.ReactNode => {
    if (!search || !val) return val
    const lower = val.toLowerCase()
    const idx = lower.indexOf(search)
    if (idx === -1) return val
    return (
      <>
        {val.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-700/60 dark:text-yellow-50 px-0.5">
          {val.slice(idx, idx + search.length)}
        </mark>
        {val.slice(idx + search.length)}
      </>
    )
  }

  const isMatchingRow = (row: string[]): boolean => {
    if (!search) return true
    return row.some((c) => c && c.toLowerCase().includes(search))
  }

  if (!cellData || cellData.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">{t('rawNoData')}</p>
  }

  return (
    <div className="border rounded-lg overflow-auto max-h-[70vh]">
      <table className="text-sm w-full border-collapse">
        <tbody>
          {cellData.map((row, rIdx) => {
            const matches = isMatchingRow(row)
            return (
              <tr
                key={rIdx}
                className={`${search && !matches ? 'opacity-30' : ''} ${
                  rIdx === 0 ? 'bg-muted font-semibold' : 'hover:bg-primary/5'
                }`}
              >
                <td className="border border-border px-2 py-1 text-xs text-muted-foreground sticky left-0 bg-muted/50 font-mono">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => {
                  const isError = cell?.startsWith('#')
                  return (
                    <td
                      key={cIdx}
                      className={`border border-border px-2 py-1 whitespace-nowrap ${
                        isError ? 'text-red-400 italic text-xs' : ''
                      }`}
                    >
                      {isError ? '' : highlightCell(cell || '')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function WorkflowPanel({
  approvals,
  history,
  requiresApproval,
  status,
}: {
  approvals: Approval[]
  history: HistoryEntry[]
  requiresApproval: boolean
  status: string
}) {
  const t = useTranslations('admin.baremes')
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {t('workflowApprovals')}
            {requiresApproval && (
              <Badge variant="outline" className="text-[10px]">
                {t('workflowFourEyes')}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!requiresApproval && (
            <p className="text-xs text-muted-foreground mb-3">
              {t('workflowNoApprovalNeeded')}
            </p>
          )}
          {approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('workflowNoApprovals')}
            </p>
          ) : (
            <ul className="space-y-3">
              {approvals.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div>
                      <span className="font-medium">{a.approverName ?? a.approverEmail}</span>
                      {a.approverName && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {a.approverEmail}
                        </span>
                      )}
                    </div>
                    {a.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">« {a.comment} »</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.createdAt).toLocaleString('fr-BE')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {requiresApproval && (status === 'draft' || status === 'pending_approval') && (
            <div className="mt-4 p-3 rounded-md bg-muted/40 text-xs">
              <p>
                {t.rich('workflowRemaining', {
                  count: Math.max(0, 2 - approvals.length),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </p>
              <p className="text-muted-foreground mt-1">
                {t('workflowApproverNote')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('workflowHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('workflowNoHistory')}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3 pb-2 border-b last:border-0">
                  <div className="text-[10px] text-muted-foreground font-mono shrink-0 w-24 pt-0.5">
                    {new Date(h.createdAt).toLocaleString('fr-BE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ActionBadge action={h.action} />
                      {h.fromStatus && h.toStatus && h.fromStatus !== h.toStatus && (
                        <span className="text-xs text-muted-foreground">
                          {h.fromStatus} → {h.toStatus}
                        </span>
                      )}
                    </div>
                    {h.actorEmail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t('byActor', { actor: h.actorEmail })}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const tones: Record<string, string> = {
    created: 'bg-blue-100 text-blue-900',
    published: 'bg-green-100 text-green-900',
    force_published: 'bg-yellow-100 text-yellow-900',
    rejected: 'bg-red-100 text-red-900',
    archived: 'bg-muted text-muted-foreground',
    rollback: 'bg-purple-100 text-purple-900',
    approved: 'bg-green-50 text-green-700',
    submitted_for_approval: 'bg-orange-100 text-orange-900',
  }
  const tone = tones[action] ?? 'bg-muted'
  return (
    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${tone}`}>
      {action.replace(/_/g, ' ')}
    </span>
  )
}
