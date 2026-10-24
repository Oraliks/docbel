'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Circle, FileSpreadsheet, RefreshCw, Search, ShieldCheck, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatNumber } from '@/lib/i18n/format'
import { sameComparisonSnapshot } from '@/lib/baremes/comparisonIdentity'
import type { Locale } from '@/i18n/locales'

type ChangeType = 'modified' | 'unchanged' | 'added' | 'disappeared' | 'ambiguous'
type Trace = {
  sourceCell?: string
  rawValue?: string
  normalizedValue?: number | string | null
  sourceFormula?: string | null
  transformReason?: string | null
  mappingFile?: string | null
  transformTemplate?: string | null
  rate?: number | null
}
type Amount = {
  id: string
  comparisonKey: string
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
  trace: Trace | null
}
type Change = {
  type: ChangeType
  key: string
  oldValue?: number
  newValue?: number
  category: string | null
  sourceSheet?: string | null
  amountChanged?: boolean
  changedAttributes?: string[]
  amountComparable?: boolean
  old?: Amount
  current?: Amount
  warning?: string
}
type FileRef = { id: string; name: string; validFrom: string | null; dataRevision: string }
type ComparisonFileRef = FileRef & { status: string; fileType: string }
type Snapshot = { version: 1; state: 'computed' | 'first_import' | 'reference_unavailable'; candidate: ComparisonFileRef; reference: ComparisonFileRef | null; computedAt: string }
type PublicationDateStatus = 'missing' | 'future' | 'applicable'
type ComparisonAttribute = 'category' | 'unit' | 'minDailySalary' | 'maxDailySalary' | 'article' | 'allocationCode' | 'salaryCode' | 'rate'
type ComparisonResponse = {
  state: 'ready' | 'stale' | 'legacy_unavailable'
  comparison?: Snapshot
  sources?: Record<string, { available: boolean; amountsCount: number; uploadedAt: string; publishedAt: string | null }>
  comparisonAlerts?: Array<{ problem?: { id: string; category: string; publicationEffect: string; allowedActions: string[]; affectedKeys?: string[]; affectedCount: number } }>
  counts?: Record<ChangeType, number>
  total?: number
  filteredTotal?: number
  range?: { start: number; end: number }
  page?: number
  facets?: { sheets: string[]; categories: string[] }
  items?: Change[]
  error?: string
}

interface Props {
  file: {
    id: string
    name: string
    status: string
    validFrom: string | null
    uploadedAt: string
    publishedAt: string | null
    sourceAvailable: boolean
    requiresApproval: boolean
    publicationDateStatus: PublicationDateStatus
  }
  totalAmounts: number
  parsedSheets: number
  detectedSheets: number
  hasBlockingIssues: boolean
  approvalCount: number
  canRecoverComparison: boolean
  history: Array<{ action: string; actorEmail?: string | null; details: Record<string, unknown> | null }>
  onReview: (comparison: Snapshot) => Promise<void>
  onPublish: () => Promise<void>
  onApprove: () => Promise<void>
  onRefresh: () => Promise<void>
  busy: boolean
}

const changeOrder: ChangeType[] = ['modified', 'added', 'disappeared', 'unchanged', 'ambiguous']

export function ComparisonWorkspace(props: Props) {
  const t = useTranslations('admin.baremes')
  const locale = useLocale() as Locale
  const [state, setState] = useState<ChangeType | ''>('')
  const [q, setQ] = useState('')
  const [sheet, setSheet] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const requestComparison = useCallback(async (): Promise<ComparisonResponse> => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' })
      if (state) params.set('state', state)
      if (q.trim()) params.set('q', q.trim())
      if (sheet) params.set('sheet', sheet)
      if (category) params.set('category', category)
      const response = await fetch(`/api/baremes/import/${props.file.id}/comparison?${params}`)
      const body = await response.json() as ComparisonResponse
      if (!response.ok && response.status !== 409) throw new Error(body.error ?? t('comparisonLoadError'))
      return body
    } catch (error) {
      return { state: 'legacy_unavailable', error: error instanceof Error ? error.message : t('comparisonLoadError') }
    }
  }, [category, page, props.file.id, q, sheet, state, t])

  useEffect(() => {
    let active = true
    void requestComparison().then((result) => {
      if (active) setData(result)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [requestComparison])

  const snapshot = data?.comparison
  const reviewed = useMemo(() => props.history.some((event) => {
    if (event.action !== 'comparison_reviewed') return false
    const reviewedSnapshot = (event.details as { comparison?: Snapshot } | null)?.comparison
    return Boolean(reviewedSnapshot && snapshot && sameComparisonSnapshot(reviewedSnapshot, snapshot))
  }), [props.history, snapshot])

  const rows = data?.items ?? []
  const selected = rows.find((row) => `${row.key}:${row.current?.id ?? row.old?.id ?? row.type}` === selectedId) ?? null
  const setFilter = (value: ChangeType | '') => { setLoading(true); setPage(1); setState((current) => current === value ? '' : value) }
  const range = data?.range
  const stale = data?.state === 'stale'
  const isDraft = props.file.status === 'draft' || props.file.status === 'pending_approval'
  const effectiveDateReady = props.file.publicationDateStatus === 'applicable'
  const canReview = isDraft && !props.busy && !loading && data?.state === 'ready' && snapshot?.state !== 'reference_unavailable' && effectiveDateReady
  const confirmationProblems = (data?.comparisonAlerts ?? []).filter((alert) => alert.problem?.category === 'anomaly'
    && alert.problem.publicationEffect === 'review' && alert.problem.allowedActions.includes('confirm_change'))
  const missingConfirmationCount = confirmationProblems.filter((alert) => {
    const problem = alert.problem!
    const keys = [...new Set(problem.affectedKeys ?? [])].sort()
    if (!keys.length || keys.length !== problem.affectedCount) return true
    return !props.history.some((event) => {
      if (event.action !== 'comparison_change_confirmed' || !event.actorEmail) return false
      const details = event.details as { version?: number; problemId?: string; reason?: string; reviewedKeys?: string[]; comparison?: Snapshot; candidateDataRevision?: string; referenceDataRevision?: string | null } | null
      return Boolean(details && details.version === 1 && details.problemId === problem.id
        && typeof details.reason === 'string' && details.reason.trim().length >= 20
        && details.comparison && snapshot && sameComparisonSnapshot(details.comparison, snapshot)
        && details.candidateDataRevision === snapshot.candidate.dataRevision
        && details.referenceDataRevision === snapshot.reference?.dataRevision
        && JSON.stringify([...(details.reviewedKeys ?? [])].sort()) === JSON.stringify(keys))
    })
  }).length
  const canPublish = canReview && reviewed && missingConfirmationCount === 0 && props.file.sourceAvailable && !props.hasBlockingIssues && props.parsedSheets === props.detectedSheets && (data?.counts?.ambiguous ?? 0) === 0
  const showApproval = props.file.requiresApproval && props.file.status !== 'published'

  const refresh = async () => { await props.onRefresh(); setLoading(true); setData(await requestComparison()); setLoading(false) }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
    <ol aria-label={t('workflowStepsLabel')} className="grid min-w-72 flex-1 grid-cols-3 gap-2">
      {(['workflowStepImport', 'workflowStepCompare', 'workflowStepPublish'] as const).map((key, index) => {
        const isPublished = props.file.status === 'published'
        const complete = index === 0 || (index === 1 && isPublished)
        const active = (index === 1 && !isPublished) || (index === 2 && isPublished)
        return <li key={key} aria-current={active ? 'step' : undefined} className="flex items-center gap-2 border-b-2 pb-2 text-sm">
          <span className={`grid size-8 shrink-0 place-items-center rounded-full border ${active ? 'border-primary bg-primary text-primary-foreground' : complete ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/30 text-muted-foreground'}`}>
            {complete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
          </span>
          <span className={active ? 'font-semibold' : 'text-muted-foreground'}>{t(key)}</span>
        </li>
      })}
    </ol>
    <Button type="button" variant="outline" render={<Link href="/admin/baremes/import" />}><Upload className="mr-2 size-4" />{t('comparisonImportAnother')}</Button>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <VersionCard title={t('comparisonBeforeCard')} file={snapshot?.reference ?? null} sourceAvailable={snapshot?.reference ? data?.sources?.[snapshot.reference.id]?.available === true : false} amountsCount={snapshot?.reference ? data?.sources?.[snapshot.reference.id]?.amountsCount : null} dateLabel={t('comparisonEffectiveDate')} missingText={t('comparisonNoPublishedReference')} t={t} locale={locale} uploadedAt={snapshot?.reference ? data?.sources?.[snapshot.reference.id]?.uploadedAt : undefined} publishedAt={snapshot?.reference ? data?.sources?.[snapshot.reference.id]?.publishedAt : null} />
      <VersionCard title={t('comparisonAfterCard')} file={{ id: props.file.id, name: props.file.name, validFrom: props.file.validFrom, dataRevision: snapshot?.candidate.dataRevision ?? '' }} sourceAvailable={props.file.sourceAvailable} amountsCount={props.totalAmounts} dateLabel={t('comparisonEffectiveDate')} missingText={t('comparisonCandidateUnavailable')} t={t} locale={locale} uploadedAt={props.file.uploadedAt} publishedAt={props.file.publishedAt} />
    </div>

    {snapshot?.state === 'first_import' && <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">{t('comparisonFirstImport')}</p>}
    {snapshot?.state === 'reference_unavailable' && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t('comparisonReferenceUnavailable')}</p>}
    {data?.state === 'legacy_unavailable' && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span>{props.canRecoverComparison ? t('comparisonPending') : t('comparisonHistoricUnavailable')}</span>{props.canRecoverComparison && isDraft && <Button type="button" variant="outline" onClick={refresh} disabled={props.busy}><RefreshCw className="mr-2 size-4" />{t('comparisonRefresh')}</Button>}</div>}
    {data?.error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{data.error}</p>}
    {stale && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" />{t('comparisonStale')}</span>{isDraft && <Button type="button" variant="outline" onClick={refresh} disabled={props.busy}><RefreshCw className="mr-2 size-4" />{t('comparisonRefresh')}</Button>}</div>}
    {props.file.publicationDateStatus !== 'applicable' && isDraft && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t(`comparisonDate_${props.file.publicationDateStatus}`)}</p>}
    {missingConfirmationCount > 0 && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{t('comparisonConfirmationsRequired', { count: missingConfirmationCount })} <Link className="font-medium underline" href={`/admin/baremes/import/${props.file.id}?tab=issues`}>{t('comparisonOpenConfirmations')}</Link></p>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {changeOrder.slice(0, 4).map((kind) => <button key={kind} type="button" aria-pressed={state === kind} onClick={() => setFilter(kind)} className={`rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${state === kind ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}`}>
        <span className="block text-xs text-muted-foreground">{t(`comparisonCounter_${kind}`)}</span>
        <span className="mt-1 block text-2xl font-semibold tabular-nums">{data?.counts?.[kind] ?? '—'}</span>
      </button>)}
    </div>
    {(data?.counts?.ambiguous ?? 0) > 0 && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"><strong>{t('comparisonAmbiguityTitle')}</strong> {t('comparisonAmbiguityBody', { count: data?.counts?.ambiguous ?? 0 })}</div>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
      <Card className="min-w-0">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('comparisonOverviewTitle')}</h2>
            <span className="text-xs text-muted-foreground">{t('comparisonScope')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm" value={q} onChange={(event) => { setLoading(true); setPage(1); setQ(event.target.value) }} placeholder={t('comparisonSearch')} aria-label={t('comparisonSearch')} />
            </label>
            <select className="h-9 max-w-full rounded-md border bg-background px-2 text-sm" value={sheet} onChange={(event) => { setLoading(true); setPage(1); setSheet(event.target.value) }} aria-label={t('comparisonSheet')}><option value="">{t('comparisonAllSheets')}</option>{(data?.facets?.sheets ?? []).map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className="h-9 max-w-full rounded-md border bg-background px-2 text-sm" value={category} onChange={(event) => { setLoading(true); setPage(1); setCategory(event.target.value) }} aria-label={t('comparisonCategory')}><option value="">{t('comparisonAllCategories')}</option>{(data?.facets?.categories ?? []).map((value) => <option key={value} value={value}>{value}</option>)}</select>
            {(state || q || sheet || category) && <Button type="button" variant="ghost" onClick={() => { setLoading(true); setPage(1); setState(''); setQ(''); setSheet(''); setCategory('') }}>{t('comparisonReset')}</Button>}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left">{t('comparisonCode')}</th><th className="px-3 py-2 text-left">{t('comparisonLabel')}</th><th className="px-3 py-2 text-right">{t('comparisonBefore')}</th><th className="px-3 py-2 text-right">{t('comparisonAfter')}</th><th className="px-3 py-2 text-left">{t('comparisonStatus')}</th></tr></thead>
              <tbody>{rows.map((row) => {
                const itemId = `${row.key}:${row.current?.id ?? row.old?.id ?? row.type}`
                const item = row.current ?? row.old
                const label = item?.labelFr || item?.labelNl || item?.article || t('comparisonLabelUnavailable')
                return <tr key={itemId} className={`border-t ${selectedId === itemId ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                  <td className="px-3 py-2"><button type="button" className="font-mono text-xs underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedId(itemId)}>{item?.allocationCode ?? item?.salaryCode ?? row.key}</button><div className="text-[11px] text-muted-foreground">{item?.sourceSheet ?? row.category ?? '—'}</div></td>
                  <td className="max-w-64 px-3 py-2"><button type="button" className="text-left" onClick={() => setSelectedId(itemId)}><span className="block truncate">{label}</span>{item?.article && <span className="block text-[11px] text-muted-foreground">{item.article}</span>}</button></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatAmount(row.oldValue, row.old?.unit, locale, t)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatAmount(row.newValue, row.current?.unit, locale, t)}</td>
                  <td className="px-3 py-2"><Badge variant={row.type === 'ambiguous' ? 'destructive' : row.type === 'modified' ? 'default' : 'secondary'}>{t(`comparisonState_${row.type}`)}</Badge>{row.changedAttributes?.length ? <span className="mt-1 block text-[10px] text-muted-foreground">{row.changedAttributes.map((attribute) => t(`comparisonAttribute_${attribute}` as `comparisonAttribute_${ComparisonAttribute}`)).join(', ')}</span> : null}</td>
                </tr>
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">{loading ? t('loading') : t('comparisonNoRows')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{t('comparisonRange', { start: range?.start ?? 0, end: range?.end ?? 0, total: data?.filteredTotal ?? 0, global: data?.total ?? 0 })}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1) }}>{t('comparisonPrevious')}</Button><Button size="sm" variant="outline" disabled={loading || !data || (range?.end ?? 0) >= (data.filteredTotal ?? 0)} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>{t('comparisonNext')}</Button></div></div>
        </CardContent>
      </Card>

      <Card className="min-w-0 xl:sticky xl:top-24 xl:self-start">
        <CardContent className="p-4">
          {!selected ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><FileSpreadsheet className="size-8 opacity-50" /><p>{t('comparisonSelectRow')}</p></div> : <AmountDetail row={selected} data={data} locale={locale} t={t} />}
        </CardContent>
      </Card>
    </div>

    <Card className="border-primary/20 bg-primary/[0.025]">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
        <div className="min-w-48"><h2 className="text-lg font-semibold">{t('comparisonPublishTitle')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('comparisonPublishIntro')}</p></div>
        <ul className="grid flex-1 gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
          <Readiness ready={props.file.sourceAvailable && !props.hasBlockingIssues && props.parsedSheets === props.detectedSheets} text={t('comparisonReadySource')} />
          <Readiness ready={data?.state === 'ready' && (data?.counts?.ambiguous ?? 0) === 0} text={t('comparisonReadyDiff')} />
          <Readiness ready={effectiveDateReady} text={t(`comparisonReadyDate_${props.file.publicationDateStatus}`)} />
          <Readiness ready={reviewed} text={t('comparisonReadyReview')} />
          <Readiness ready={missingConfirmationCount === 0} text={t('comparisonReadyConfirmations', { count: missingConfirmationCount })} />
          {props.file.requiresApproval && <Readiness ready={props.approvalCount >= 2} text={t('comparisonReadyApprovals', { count: props.approvalCount })} />}
        </ul>
        <div className="flex flex-wrap gap-2">
          {isDraft && !reviewed && <Button type="button" variant="outline" onClick={() => snapshot && void props.onReview(snapshot)} disabled={!canReview || stale}><ShieldCheck className="mr-2 size-4" />{t('comparisonReview')}</Button>}
          {isDraft && (showApproval
            ? <Button type="button" onClick={props.onApprove} disabled={!canPublish}><CheckCircle2 className="mr-2 size-4" />{t('approveWithCount', { count: props.approvalCount })}</Button>
            : <Button type="button" onClick={props.onPublish} disabled={!canPublish}><ArrowRight className="mr-2 size-4" />{t('comparisonPublishButton')}</Button>)}
          {props.file.status === 'published' && <Badge className="self-center"><CheckCircle2 className="mr-1 size-4" />{t('comparisonPublished')}</Badge>}
        </div>
      </CardContent>
    </Card>
  </div>
}

function VersionCard({ title, file, sourceAvailable, amountsCount, dateLabel, missingText, t, locale, uploadedAt, publishedAt }: {
  title: string; file: FileRef | null; sourceAvailable: boolean; amountsCount: number | null | undefined; dateLabel: string; missingText: string
  t: ReturnType<typeof useTranslations<'admin.baremes'>>; locale: Locale; uploadedAt?: string; publishedAt?: string | null
}) {
  return <Card className="overflow-hidden">
    <CardContent className="flex h-full gap-3 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted"><FileSpreadsheet className="size-5 text-primary" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{title}</h2>
        {!file ? <p className="mt-2 text-sm text-muted-foreground">{missingText}</p> : <>
          <p className="mt-1 truncate text-sm font-medium" title={file.name}>{file.name}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
            <div><span className="block text-muted-foreground">{dateLabel}</span><span className="mt-1 inline-flex items-center gap-1 font-medium">{file.validFrom ? <><CalendarDays className="size-3" />{formatDate(file.validFrom, locale)}</> : '—'}</span></div>
            <div><span className="block text-muted-foreground">{t('comparisonVolume')}</span><span className="mt-1 block font-medium">{amountsCount == null ? '—' : formatNumber(amountsCount, locale)} {t('comparisonAmountUnit')}</span></div>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {uploadedAt && <span>{t('comparisonImportedAt', { date: formatDate(uploadedAt, locale) })}</span>}
            {publishedAt && <span>{t('comparisonPublishedAt', { date: formatDate(publishedAt, locale) })}</span>}
            {sourceAvailable ? <Link className="text-primary underline underline-offset-2" href={`/api/baremes/import/${file.id}/source`} target="_blank">{t('comparisonViewSource')}</Link> : <span>{t('sourceUnavailable')}</span>}
            <Link className="text-primary underline underline-offset-2" href={`/admin/baremes/import/${file.id}?view=amounts`}>{t('comparisonViewAmounts')}</Link>
          </div>
        </>}
      </div>
    </CardContent>
  </Card>
}

function AmountDetail({ row, data, locale, t }: { row: Change; data: ComparisonResponse | null; locale: Locale; t: ReturnType<typeof useTranslations<'admin.baremes'>> }) {
  const item = row.current ?? row.old
  if (!item) return null
  const label = item.labelFr || item.labelNl || item.article || t('comparisonLabelUnavailable')
  const oldSource = row.old ? data?.sources?.[data.comparison?.reference?.id ?? ''] : null
  const newSource = row.current ? data?.sources?.[data.comparison?.candidate.id ?? ''] : null
  const displayTrace = (side: 'old' | 'current') => {
    const amount = side === 'old' ? row.old : row.current
    const file = side === 'old' ? data?.comparison?.reference : data?.comparison?.candidate
    const source = side === 'old' ? oldSource : newSource
    if (!amount) return <p className="text-sm text-muted-foreground">{t('comparisonNoValue')}</p>
    return <div className="space-y-1 text-xs">
      <p className="font-medium">{file?.name ?? t('comparisonSourceUnknown')}</p>
      <p>{amount.sourceSheet}{amount.trace?.sourceCell ? `!${amount.trace.sourceCell}` : ''}</p>
      <p>{t('comparisonRawValue')}: {amount.trace?.rawValue ?? '—'}</p>
      {amount.trace?.sourceFormula && <details className="pt-1"><summary className="cursor-pointer underline">{t('comparisonFormula')}</summary><code className="mt-1 block break-all rounded bg-muted p-2">={amount.trace.sourceFormula}</code></details>}
      {amount.trace?.transformReason && <p>{amount.trace.transformReason}</p>}
      {amount.trace?.mappingFile && <p className="text-muted-foreground">{t('comparisonMappingSource')}: {amount.trace.mappingFile}</p>}
      {source?.available && file && <Link className="inline-block pt-1 text-primary underline underline-offset-2" href={`/api/baremes/import/${file.id}/source`} target="_blank">{t('comparisonOpenExactSource')}</Link>}
    </div>
  }

  return <div className="space-y-4">
    <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{t('comparisonDetailTitle')}</h2><Badge variant={row.type === 'ambiguous' ? 'destructive' : 'secondary'}>{t(`comparisonState_${row.type}`)}</Badge></div><p className="mt-2 font-mono text-sm">{item.allocationCode ?? item.salaryCode ?? row.key}</p><p className="mt-1 font-medium">{label}</p><p className="text-xs text-muted-foreground">{item.category}{item.article ? ` · ${item.article}` : ''}</p></div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-muted/50 p-3 text-center"><div><p className="text-[11px] text-muted-foreground">{t('comparisonBefore')}</p><p className="mt-1 font-semibold tabular-nums">{formatAmount(row.oldValue, row.old?.unit, locale, t)}</p></div><ArrowRight className="size-4 text-muted-foreground" /><div><p className="text-[11px] text-muted-foreground">{t('comparisonAfter')}</p><p className="mt-1 font-semibold tabular-nums">{formatAmount(row.newValue, row.current?.unit, locale, t)}</p></div></div>
    <p className="text-xs text-muted-foreground">{t('comparisonContext')}: {item.sourceSheet}{item.minDailySalary != null || item.maxDailySalary != null ? ` · ${t('comparisonSalaryRange', { min: item.minDailySalary == null ? '—' : formatNumber(item.minDailySalary, locale), max: item.maxDailySalary == null ? '—' : formatNumber(item.maxDailySalary, locale) })}` : ''}{item.unit ? ` · ${unitLabel(item.unit, t)}` : ''}{item.trace?.rate != null ? ` · ${t('comparisonRate')}: ${formatNumber(item.trace.rate * 100, locale)}%` : ''}</p>
          {row.changedAttributes?.length ? <p className="text-xs"><strong>{t('comparisonChangedContext')}:</strong> {row.changedAttributes.map((attribute) => t(`comparisonAttribute_${attribute}` as `comparisonAttribute_${ComparisonAttribute}`)).join(', ')}</p> : null}
    <div className="space-y-3 border-t pt-3"><div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('comparisonSourceBefore')}</h3>{displayTrace('old')}</div><div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('comparisonSourceAfter')}</h3>{displayTrace('current')}</div></div>
    <div className="border-t pt-3"><h3 className="text-sm font-semibold">{t('comparisonUsageTitle')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('comparisonUsageFamilyNote')}</p><ul className="mt-2 space-y-1 text-xs"><li><Link className="text-primary underline underline-offset-2" href="/outils/bareme-chomage" target="_blank">{t('comparisonUsagePublic')}</Link></li><li><Link className="text-primary underline underline-offset-2" href="/partenaire/outils/verificateur-situation-familiale" target="_blank">{t('comparisonUsageVerifier')}</Link></li></ul><Badge className="mt-2" variant="outline">{t('comparisonUsageUnverified')}</Badge></div>
  </div>
}

function Readiness({ ready, text }: { ready: boolean; text: string }) {
  return <li className="flex items-start gap-2"><span className={ready ? 'text-emerald-700' : 'text-muted-foreground'}>{ready ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Circle className="size-4" aria-hidden="true" />}</span><span>{text}</span></li>
}

function formatAmount(value: number | undefined, unit: string | null | undefined, locale: Locale, t: ReturnType<typeof useTranslations<'admin.baremes'>>) {
  if (value == null) return '—'
  const formatted = formatNumber(value, locale, { maximumFractionDigits: 8 })
  const suffix = unit ? ` ${unitLabel(unit, t)}` : ''
  return `${formatted} €${suffix}`
}

function unitLabel(unit: string, t: ReturnType<typeof useTranslations<'admin.baremes'>>) {
  const unitKeys: Record<string, 'comparisonUnit_daily' | 'comparisonUnit_halfDaily' | 'comparisonUnit_monthly' | 'comparisonUnit_yearly' | 'comparisonUnit_hourly' | 'comparisonUnit_unknown'> = {
    daily: 'comparisonUnit_daily', half_daily: 'comparisonUnit_halfDaily', monthly: 'comparisonUnit_monthly', yearly: 'comparisonUnit_yearly', hourly: 'comparisonUnit_hourly',
  }
  return t(unitKeys[unit] ?? 'comparisonUnit_unknown', { unit })
}
