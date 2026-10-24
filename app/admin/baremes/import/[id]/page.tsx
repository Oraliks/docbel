'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { formatDate, formatDateTime, formatNumber } from '@/lib/i18n/format'
import { AmountsPreviewTab } from '@/components/admin/baremes/amounts-preview-tab'
import {
  IssuesTab,
  effectiveSeverity,
  type IssueItem,
} from '@/components/admin/baremes/issues-tab'
import {
  DiagnosticTab,
  type DiagnosticsPayload,
} from '@/components/admin/baremes/diagnostic-tab'
import { ConformiteTab, type AmountSampleRow } from '@/components/admin/baremes/conformite-tab'
import { ComparisonWorkspace } from '@/components/admin/baremes/comparison-workspace'
import type { BaremeAlert, BaremeComparisonSnapshot, BaremeDiagnostics } from '@/lib/baremes/types'

interface FileRecord {
  id: string
  name: string
  status: string
  sourceAvailable: boolean
  fileHash: string | null
  fileSize: number | null
  effectiveDate: string
  validFrom: string | null
  publicationDateStatus: 'missing' | 'future' | 'applicable'
  multiplicateur: number | null
  requiresApproval?: boolean
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
  diagnostics: DiagnosticsPayload | null
  alerts: IssueItem[] | null
}

type ComparisonSnapshot = BaremeComparisonSnapshot

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

interface PreviewAmount {
  comparisonKey: string
  allocationCode: string | null
  salaryCode: string | null
  amount: number
  sourceSheet: string
  trace: { sourceCell?: string; rawValue?: string } | null
}

interface PreviewData {
  file: FileRecord
  exportAllowed: boolean
  totalAmounts: number
  comparison: ComparisonSnapshot | null
  comparisonRecoverable: boolean
  history?: HistoryEntry[]
  approvals?: Approval[]
  amountsPreview?: PreviewAmount[]
}

export default function BaremeImportPreviewPage() {
  const t = useTranslations('admin.baremes')
  const locale = useLocale()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
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

  const publish = async () => {
    if (!id) return
    if (!confirm(t('previewPublishConfirm'))) return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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

  const reviewComparison = async (displayedComparison: ComparisonSnapshot) => {
    if (!id) return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparison: displayedComparison }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('comparisonReviewFailed'))
      toast.success(t('comparisonReviewRecorded'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setActing(false)
    }
  }

  const refreshComparison = async () => {
    if (!id || !confirm(t(data?.comparisonRecoverable ? 'comparisonResumeConfirm' : 'comparisonRefreshConfirm'))) return
    setActing(true)
    try {
      const res = await fetch(`/api/baremes/import/${id}/comparison`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? t('comparisonRefreshFailed'))
      toast.success(t('comparisonRefreshDone'))
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
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

  const { file, exportAllowed, totalAmounts } = data
  const alerts = file.alerts ?? []
  const summary = file.summary
  const isDraftOrPending = file.status === 'draft' || file.status === 'pending_approval'
  const isArchived = file.status === 'archived'
  const requiresApproval = file.requiresApproval === true
  const approvals = data.approvals ?? []

  // Échantillon à recouper (onglet Conformité) : montants tracés, étalés sur les
  // feuilles, plafonné à 12. Prouve à l'admin que les valeurs viennent des cellules.
  const tracedPreview = (data.amountsPreview ?? []).filter((a) => a.trace?.sourceCell)
  const amountsSample: AmountSampleRow[] = (() => {
    const bySheet = new Map<string, PreviewAmount[]>()
    for (const a of tracedPreview) {
      const list = bySheet.get(a.sourceSheet) ?? []
      list.push(a)
      bySheet.set(a.sourceSheet, list)
    }
    const picked: PreviewAmount[] = []
    // 1er passage : 1 par feuille (variété) ; passages suivants : on complète.
    let round = 0
    while (picked.length < 12 && round < 6) {
      for (const list of bySheet.values()) {
        if (list[round] && picked.length < 12) picked.push(list[round])
      }
      round++
    }
    return picked.map((a) => ({
      comparisonKey: a.comparisonKey,
      allocationCode: a.allocationCode,
      salaryCode: a.salaryCode,
      amount: a.amount,
      sourceSheet: a.sourceSheet,
      sourceCell: a.trace?.sourceCell ?? '',
      rawValue: a.trace?.rawValue ?? '',
    }))
  })()
  const history = data.history ?? []
  const errorCount = alerts.filter((a) => {
    const s = effectiveSeverity(a)
    return s === 'error' || s === 'critical'
  }).length
  const warnCount = alerts.filter((a) => effectiveSeverity(a) === 'warning').length

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
              <h1 className="text-xl font-bold truncate">{t('comparisonWorkflowTitle')}</h1>
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${statusInfo.tone}`}>
                {statusInfo.label}
              </span>
              {exportAllowed ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border bg-green-100 text-green-900 border-green-300">
                  <ShieldCheck className="w-3 h-3" />
                  {t('exportAllowedBadge')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border bg-red-100 text-red-900 border-red-300">
                  <ShieldAlert className="w-3 h-3" />
                  {t('exportBlockedBadge')}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={file.name}>{file.name}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {file.validFrom
                  ? t('validSince', { date: formatDate(file.validFrom, locale) })
                  : t('rawDate', { date: file.effectiveDate || '—' })}
              </span>
              {file.multiplicateur && <span>×{file.multiplicateur.toFixed(4)}</span>}
              {file.fileSize != null && <span>{formatBytes(file.fileSize)}</span>}
              <span className="font-mono">
                {t('hashLabel', { hash: file.fileHash ? file.fileHash.slice(0, 10) + '…' : t('hashLegacy') })}
              </span>
              {file.createdBy && <span>{t('byActor', { actor: file.createdBy })}</span>}
              {file.publishedAt && (
                <span>{t('publishedOn', { date: formatDate(file.publishedAt, locale) })}</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {isDraftOrPending && (
              <Button variant="outline" onClick={() => reject()} disabled={acting} className="text-red-600 hover:text-red-700" size="sm">{t('reject')}</Button>
            )}
            {isArchived && (
              <Button onClick={rollback} disabled={acting} variant="outline" size="sm">
                {t('restoreVersion')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <ComparisonWorkspace
        file={{ id: file.id, name: file.name, status: file.status, validFrom: file.validFrom, publicationDateStatus: file.publicationDateStatus, uploadedAt: file.createdAt, publishedAt: file.publishedAt, sourceAvailable: file.sourceAvailable, requiresApproval }}
        totalAmounts={totalAmounts}
        parsedSheets={summary?.sheetsParsed ?? 0}
        detectedSheets={summary?.sheetsDetected ?? 0}
        hasBlockingIssues={errorCount > 0}
        approvalCount={approvals.length}
        canRecoverComparison={data.comparisonRecoverable}
        history={history}
        onReview={reviewComparison}
        onPublish={publish}
        onApprove={approve}
        onRefresh={refreshComparison}
        busy={acting}
      />

      <details open={Boolean(searchParams.get('tab') || searchParams.get('view'))} className="rounded-xl border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('secondaryToolsTitle')}</summary>
      <div className="mt-4 space-y-4">
      {/* Détails conservés en second niveau pour consultation, export et audit. */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label={t('statSheetsDetected')} value={summary.sheetsDetected} />
          <Stat label={t('statSheetsParsed')} value={summary.sheetsParsed} tone="success" />
          <Stat label={t('statSheetsIgnored')} value={summary.sheetsIgnored} tone="muted" />
          <Stat label={t('kpiAmountsExtracted')} value={totalAmounts} tone="primary" />
          <Stat label={t('statErrors')} value={errorCount} tone={errorCount > 0 ? 'error' : 'muted'} />
          <Stat label={t('statWarnings')} value={warnCount} tone={warnCount > 0 ? 'warn' : 'muted'} />
        </div>
      )}

      <Tabs defaultValue={searchParams.get('tab') ?? (searchParams.get('view') === 'amounts' ? 'allocations' : 'summary')} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto">
            <TabsTrigger value="summary">{t('tabSummary')}</TabsTrigger>
            <TabsTrigger value="allocations">{t('tabAllocations')}</TabsTrigger>
            <TabsTrigger value="tranches">{t('tabBrackets')}</TabsTrigger>
            <TabsTrigger value="montants-base">{t('tabBasicAmounts')}</TabsTrigger>
            <TabsTrigger value="issues">
              {t('tabIssues')}
              {alerts.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="diagnostic">{t('tabDiagnostic')}</TabsTrigger>
            <TabsTrigger value="conformite">{t('tabConformite')}</TabsTrigger>
            <TabsTrigger value="workflow">
              {t('tabWorkflow')}
              {(approvals.length > 0 || history.length > 0) && (
                <Badge variant="secondary" className="ml-2">
                  {approvals.length + history.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary">
          <SummaryTab
            file={file}
            exportAllowed={exportAllowed}
            totalAmounts={totalAmounts}
            errorCount={errorCount}
            warnCount={warnCount}
          />
        </TabsContent>

        <TabsContent value="allocations">
          <AmountsPreviewTab fileId={file.id} group="allocations" exportAllowed={exportAllowed} />
        </TabsContent>

        <TabsContent value="tranches">
          <AmountsPreviewTab fileId={file.id} group="tranches" exportAllowed={exportAllowed} />
        </TabsContent>

        <TabsContent value="montants-base">
          <AmountsPreviewTab fileId={file.id} group="montants-base" exportAllowed={exportAllowed} />
        </TabsContent>

        <TabsContent value="issues">
          <IssuesTab issues={alerts} fileId={file.id} comparison={data.comparison} onConfirmed={load} />
        </TabsContent>

        <TabsContent value="conformite">
          <ConformiteTab
            diagnostics={(file.diagnostics ?? {}) as unknown as BaremeDiagnostics}
            alerts={alerts as unknown as BaremeAlert[]}
            amountsSample={amountsSample}
          />
        </TabsContent>

        <TabsContent value="diagnostic">
          <DiagnosticTab fileId={file.id} diagnostics={file.diagnostics} />
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
      </details>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

function SummaryTab({
  file,
  exportAllowed,
  totalAmounts,
  errorCount,
  warnCount,
}: {
  file: FileRecord
  exportAllowed: boolean
  totalAmounts: number
  errorCount: number
  warnCount: number
}) {
  const t = useTranslations('admin.baremes')
  const locale = useLocale()
  const summary = file.summary
  const dl = (type: string) =>
    window.open(`/api/baremes/import/${file.id}/export?type=${type}`, '_blank')

  return (
    <div className="space-y-4">
      {/* Verdict export */}
      <Card className={exportAllowed ? 'border-green-300' : 'border-red-300'}>
        <CardContent className="py-4 flex items-start gap-3">
          {exportAllowed ? (
            <ShieldCheck className="w-6 h-6 text-green-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-medium text-sm">
              {exportAllowed ? t('summaryExportOk') : t('summaryExportBlocked')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exportAllowed
                ? t('summaryExportOkDetail', { errors: errorCount, warnings: warnCount })
                : t('summaryExportBlockedDetail', { errors: errorCount })}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fiche fichier */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('summaryFileCard')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">{t('summaryFileName')}</dt>
              <dd className="font-mono break-all">{file.name}</dd>
              <dt className="text-muted-foreground">{t('summaryPeriod')}</dt>
              <dd className="font-medium">
                {file.validFrom
                  ? formatDate(file.validFrom, locale)
                  : t('summaryPeriodMissing')}
              </dd>
              <dt className="text-muted-foreground">{t('summarySize')}</dt>
              <dd>{file.fileSize != null ? formatBytes(file.fileSize) : '—'}</dd>
              <dt className="text-muted-foreground">SHA-256</dt>
              <dd className="font-mono break-all">{file.fileHash ?? '—'}</dd>
              {file.multiplicateur && (
                <>
                  <dt className="text-muted-foreground">{t('colMultiplier')}</dt>
                  <dd className="font-mono">×{file.multiplicateur.toFixed(4)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t('summaryImportedBy')}</dt>
              <dd>
                {file.createdBy ?? '—'} · {formatDateTime(file.createdAt, locale)}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {/* Téléchargements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('summaryDownloads')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!exportAllowed} onClick={() => dl('allocations')}
                title={exportAllowed ? undefined : t('exportBlockedTooltip')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                baremes-allocations.csv
              </Button>
              <Button size="sm" disabled={!exportAllowed} onClick={() => dl('tranches')}
                title={exportAllowed ? undefined : t('exportBlockedTooltip')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                tranches-salariales.csv
              </Button>
              <Button size="sm" disabled={!exportAllowed} onClick={() => dl('montants-base')}
                title={exportAllowed ? undefined : t('exportBlockedTooltip')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                montants-base.csv
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => dl('report')}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                import-report.json
              </Button>
              <Button variant="outline" size="sm" onClick={() => dl('unknown-codes')}>
                unknown-codes.json
              </Button>
              <Button variant="outline" size="sm" onClick={() => dl('ignored-rows')}>
                ignored-rows.csv
              </Button>
              <Button variant="outline" size="sm" onClick={() => dl('unsupported-sheets')}>
                unsupported-sheets.json
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('summaryReportsHint')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Feuilles */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t('tabSheets')} — {summary?.sheetsParsed ?? 0}/{summary?.sheetsDetected ?? 0}{' '}
            {t('summarySheetsParsed')} · {formatNumber(totalAmounts, locale)}{' '}
            {t('summaryRowsExtracted')}
          </CardTitle>
        </CardHeader>
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
              {(summary?.sheetsByName ?? []).map((s) => (
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
  const locale = useLocale()
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
      <div className="text-2xl font-semibold">{formatNumber(value, locale)}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
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
  const locale = useLocale()
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
                      {formatDateTime(a.createdAt, locale)}
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
                    {formatDateTime(h.createdAt, locale)}
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
