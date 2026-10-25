'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlertCircle, ArrowRight, Check, ChevronLeft, ChevronRight, FileSpreadsheet, FileUp, RefreshCw, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { formatDate, formatNumber } from '@/lib/i18n/format'
import type { ChangeKind, Difference, RateValue, Snapshot, VersionRef, Workspace } from '@/lib/baremes-autonome/types'
import type { Locale } from '@/i18n/locales'

const PAGE_SIZE = 50
const kinds: ChangeKind[] = ['modified', 'added', 'absent', 'unchanged']
type ListResponse = { versions: VersionRef[]; publishedId: string | null }
type ApiError = { error?: string; code?: string }

export function BaremesAutonomeWorkspace() {
  const t = useTranslations('admin.autonomousRates')
  const locale = useLocale() as Locale
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedVersion = searchParams.get('version') ?? ''
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [list, setList] = useState<ListResponse>({ versions: [], publishedId: null })
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [versionId, setVersionId] = useState(searchParams.get('version') ?? '')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [sheet, setSheet] = useState('')
  const [kind, setKind] = useState<ChangeKind | ''>('')
  const [selected, setSelected] = useState<Difference | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploadName, setUploadName] = useState('')
  const workspaceRequest = useRef(0)
  const workspaceAbort = useRef<AbortController | null>(null)

  const loadVersions = useCallback(async () => {
    const response = await fetch('/api/admin/baremes-autonome/versions', { cache: 'no-store' })
    if (!response.ok) throw new Error('load')
    const data = await response.json() as ListResponse
    setList(data)
    return data
  }, [])

  const loadWorkspace = useCallback(async (id: string, nextPage = page) => {
    const requestId = ++workspaceRequest.current
    workspaceAbort.current?.abort()
    if (!id) { setWorkspace(null); setLoading(false); return false }
    const controller = new AbortController()
    workspaceAbort.current = controller
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(nextPage) })
      if (query.trim()) params.set('q', query.trim())
      if (sheet) params.set('sheet', sheet)
      if (kind) params.set('kind', kind)
      const response = await fetch(`/api/admin/baremes-autonome/versions/${encodeURIComponent(id)}?${params}`, { cache: 'no-store', signal: controller.signal })
      const data = await response.json() as Workspace & ApiError
      if (!response.ok) throw new Error(data.code || 'load')
      if (requestId !== workspaceRequest.current) return false
      setWorkspace(data)
      setSelected((current) => data.items.find((item) => item.key === current?.key) ?? data.items[0] ?? null)
      return true
    } catch (cause) {
      if (requestId === workspaceRequest.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setError(t('errors.load'))
      return false
    } finally { if (requestId === workspaceRequest.current) setLoading(false) }
  }, [kind, page, query, sheet, t])

  useEffect(() => { void Promise.resolve().then(() => loadVersions()).then((data) => {
    const initial = requestedVersion || data.versions[0]?.id || ''
    setVersionId(current => current || initial)
    if (!initial) setLoading(false)
  }).catch(() => { setError(t('errors.load')); setLoading(false) }) }, [loadVersions, requestedVersion, t])
  useEffect(() => {
    if (!versionId) return
    if (requestedVersion !== versionId) router.replace(`/admin/baremes-autonome?version=${encodeURIComponent(versionId)}`, { scroll: false })
    void Promise.resolve().then(() => loadWorkspace(versionId, page))
    return () => workspaceAbort.current?.abort()
  }, [versionId, requestedVersion, page, loadWorkspace, router])

  const refresh = () => { void loadVersions().catch(() => setError(t('errors.load'))); if (versionId) void loadWorkspace(versionId) }
  const onUpload = async (file?: File) => {
    if (!file) return
    if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) { setError(t('errors.xlsxOnly')); return }
    setBusy(true); setError(''); setUploadName(file.name)
    try {
      const form = new FormData(); form.append('file', file)
      const response = await fetch('/api/admin/baremes-autonome/versions', { method: 'POST', body: form })
      const data = await response.json() as { id?: string; code?: string }
      if (!response.ok || !data.id) throw new Error(data.code || 'upload')
      setPage(1); setQuery(''); setSheet(''); setKind(''); setVersionId(data.id)
      toast.success(t('uploadSuccess'))
      await loadVersions().catch(() => setError(t('refreshAfterImport')))
    } catch { setError(t('errors.upload')) } finally { setBusy(false) }
  }
  const publish = async () => {
    if (!workspace || busy) return
    setConfirmOpen(false)
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/admin/baremes-autonome/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workspace.snapshot satisfies Snapshot) })
      const data = await response.json() as ApiError
      if (!response.ok) throw new Error(data.code || 'publish')
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      await loadWorkspace(versionId)
      setError(code === 'STALE_COMPARISON' ? t('errors.stale') : code === 'BLOCKED' ? t('errors.blocked') : t('errors.publish'))
      setBusy(false)
      return
    }
    setWorkspace(current => current ? { ...current, canPublish: false } : current)
    toast.success(t('published'))
    const [history, refreshed] = await Promise.allSettled([loadVersions(), loadWorkspace(versionId)])
    if (history.status === 'rejected' || refreshed.status === 'rejected' || !refreshed.value) setError(t('refreshAfterPublish'))
    setBusy(false)
  }

  const selectedRow = selected
  const pageCount = workspace ? Math.max(1, Math.ceil(workspace.total / PAGE_SIZE)) : 1
  const step = !versionId ? 1 : workspace && list.publishedId === versionId ? 3 : 2
  const kindLabel = (value: ChangeKind) => t(`kinds.${value}`)
  const changeLabel = (row: Difference) => row.kind === 'modified' && row.contextChanged && row.before?.value === row.after?.value ? t('contextChange') : kindLabel(row.kind)
  const alreadyPublished = list.publishedId === versionId
  const formatValue = (value: string | undefined) => value == null ? '—' : (value.split('.')[1] ?? '').length > 20 ? value : formatNumber(Number(value), locale, { minimumFractionDigits: 2, maximumFractionDigits: Math.max(2, (value.split('.')[1] ?? '').length) })
  const rowLabel = (value: RateValue | null | undefined) => !value ? '—' : value.category ? value.label === 'MIN' ? t('minimum') : t('salaryBand', { code: value.label }) : value.label
  const valueFor = (row: Difference, side: 'before' | 'after') => row[side]?.value
  const issueSummary = workspace?.issues ?? []

  return <section aria-label={t('title')} aria-busy={loading || busy} className="flex w-full flex-col gap-5 px-4 py-6 md:px-6">
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('publishConfirmTitle')}</AlertDialogTitle><AlertDialogDescription>{t('publishConfirmBody')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('cancel')}</AlertDialogCancel><AlertDialogAction disabled={busy || loading || !workspace?.canPublish} onClick={() => void publish()}>{t('publish')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><FileSpreadsheet className="size-6" /></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1><Badge variant="secondary">{t('independentTool')}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p><p className="mt-1 text-xs text-muted-foreground">{t('scopeNote')}</p></div></div>
      <Button variant="outline" onClick={refresh} disabled={busy}><RefreshCw className="mr-2 size-4" />{t('refresh')}</Button>
    </header>

    {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" />{error}</div>}
    <ol aria-label={t('stepsLabel')} className="grid grid-cols-3 gap-2">
      {(['import', 'review', 'publish'] as const).map((id, index) => <li key={id} className={`relative rounded-lg border p-3 text-center ${step === index + 1 ? 'border-primary bg-primary/5' : 'bg-card'}`}><span className={`mx-auto mb-1 grid size-7 place-items-center rounded-full text-sm font-semibold ${step > index + 1 ? 'bg-primary text-primary-foreground' : step === index + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{step > index + 1 ? <Check className="size-4" /> : index + 1}</span><div className="text-sm font-medium">{t(`steps.${id}`)}</div><p className="hidden text-xs text-muted-foreground sm:block">{t(`stepDescriptions.${id}`)}</p></li>)}
    </ol>

    <section className="grid gap-4 lg:grid-cols-2" aria-label={t('versionsHeading')}>
      <VersionCard title={workspace?.reference ? t('before') : t('beforeUnavailable')} version={workspace?.reference ?? null} locale={locale} tone="muted" />
      <Card className="border-emerald-500/20 bg-emerald-500/[0.025]"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-5 text-emerald-600" />{t('after')}</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2"><select aria-label={t('historyLabel')} value={versionId} onChange={(e) => { const id = e.target.value; setPage(1); setVersionId(id); if (!id) { setWorkspace(null); setSelected(null) } }} className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"><option value="">{t('chooseVersion')}</option>{list.versions.map((v) => <option key={v.id} value={v.id}>{v.name} · {formatDate(v.createdAt, locale)}</option>)}</select>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm hover:bg-muted"><Upload className="mr-2 size-4" />{t('importFile')}<input type="file" accept=".xlsx" className="sr-only" disabled={busy || loading} onChange={(e) => { void onUpload(e.target.files?.[0]); e.currentTarget.value = '' }} /></label></div>
        {workspace ? <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3"><Meta label={t('effectiveDate')} value={workspace.candidate.effectiveFrom ? formatDate(workspace.candidate.effectiveFrom, locale) : t('unknown')} /><Meta label={t('lineCount')} value={formatNumber(workspace.candidate.count, locale)} /><Meta label={t('revision')} value={workspace.candidate.revision} /></div> : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t('emptyImport')}</p>}
        {uploadName && <p className="truncate text-xs text-muted-foreground">{t('selectedFile', { name: uploadName })}</p>}
      </CardContent></Card>
    </section>

    {workspace && <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t('countsHeading')}>
        {kinds.map((item) => <button key={item} type="button" onClick={() => { setKind(kind === item ? '' : item); setPage(1) }} aria-pressed={kind === item} className={`rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 ${kind === item ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}><div className="text-xs font-medium text-muted-foreground">{kindLabel(item)}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(workspace.counts[item], locale)}</div></button>)}
      </section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.9fr)]">
        <Card className="min-w-0"><CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between"><CardTitle className="text-base">{t('differences')}</CardTitle><div className="flex flex-wrap gap-2"><div className="relative min-w-40 flex-1 sm:max-w-xs"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} placeholder={t('searchPlaceholder')} className="pl-8" /></div><select aria-label={t('sheetLabel')} value={sheet} onChange={(e) => { setSheet(e.target.value); setPage(1) }} className="h-9 rounded-lg border border-input bg-background px-2 text-sm"><option value="">{t('allSheets')}</option>{workspace.sheets.map((value) => <option key={value}>{value}</option>)}</select></div></CardHeader>
          <CardContent className="p-0"><div className="max-h-[28rem] overflow-auto"><Table><TableHeader><TableRow><TableHead>{t('code')}</TableHead><TableHead>{t('label')}</TableHead><TableHead>{t('oldValue')}</TableHead><TableHead>{t('newValue')}</TableHead><TableHead>{t('status')}</TableHead></TableRow></TableHeader><TableBody>{workspace.items.map((row) => { const value = row.after ?? row.before; return <TableRow key={row.key} aria-selected={selected?.key === row.key} data-state={selected?.key === row.key ? 'selected' : undefined} onClick={() => setSelected(row)} className="cursor-pointer data-[state=selected]:bg-primary/10"><TableCell className="font-mono text-xs"><button type="button" className="rounded-sm text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={(event) => { event.stopPropagation(); setSelected(row) }}>{value?.code ?? row.key}</button></TableCell><TableCell className="min-w-40"><div className="max-w-64 truncate">{rowLabel(value)}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{value?.context[0] ?? '—'} · {value?.category ? t(`categories.${value.category}`) : value?.source.sheet} · {value?.unit ?? '—'}</div></TableCell><TableCell className="tabular-nums">{formatValue(valueFor(row, 'before'))}</TableCell><TableCell className="tabular-nums">{formatValue(valueFor(row, 'after'))}</TableCell><TableCell><KindBadge kind={row.kind} label={changeLabel(row)} /></TableCell></TableRow> })}</TableBody></Table></div>
            {!workspace.items.length && <p className="p-8 text-center text-sm text-muted-foreground">{loading ? t('loading') : t('noResults')}</p>}
            <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>{t('resultCount', { count: formatNumber(workspace.total, locale) })}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label={t('previousPage')} disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="size-4" /></Button><span>{t('pageOf', { page, pages: pageCount })}</span><Button variant="outline" size="icon" aria-label={t('nextPage')} disabled={page >= pageCount || loading} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}><ChevronRight className="size-4" /></Button></div></div>
          </CardContent></Card>
        <Card className="min-w-0"><CardHeader><CardTitle className="text-base">{t('detail')}</CardTitle></CardHeader><CardContent className="min-w-0 space-y-4">
          {selectedRow ? <><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold">{selectedRow.after?.code ?? selectedRow.before?.code ?? selectedRow.key}</h2><KindBadge kind={selectedRow.kind} label={changeLabel(selectedRow)} /></div><p className="font-medium">{rowLabel(selectedRow.after ?? selectedRow.before)}</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3"><Meta label={t('oldValue')} value={formatValue(valueFor(selectedRow, 'before'))} /><Meta label={t('newValue')} value={formatValue(valueFor(selectedRow, 'after'))} /></div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">{([{ side: 'before', value: selectedRow.before, versionId: workspace.reference?.id, date: workspace.reference?.effectiveFrom, title: t('before') }, { side: 'after', value: selectedRow.after, versionId: workspace.candidate.id, date: workspace.candidate.effectiveFrom, title: t('after') }] as const).map(({ side, value, versionId: sourceVersionId, date, title }) => <section key={side} className="min-w-0 space-y-2 rounded-lg border p-3 text-sm [overflow-wrap:anywhere]"><h3 className="font-medium">{title}</h3>{value ? <><p><span className="text-muted-foreground">{t('unitSource')}:</span> {value.unit}</p>{value.indexation && <p><span className="text-muted-foreground">{t('indexationMultiplier')}:</span> {formatValue(value.indexation.value)} ({value.indexation.source.sheet} · {value.indexation.source.cell})</p>}<p><span className="text-muted-foreground">{t('context')}:</span> {value.category ? t(`categories.${value.category}`) : value.source.sheet} · {value.context.join(' · ') || '—'}</p><p><span className="text-muted-foreground">{t('effectiveDate')}:</span> {date ? formatDate(date, locale) : t('unknown')}</p><p><span className="text-muted-foreground">{t('source')}:</span> {value.source.sheet} · {value.source.cell}</p><details><summary className="cursor-pointer text-muted-foreground">{t('formula')}</summary><p className="mt-1 break-all font-mono text-xs">{value.source.formula ?? t('noFormula')}</p></details>{sourceVersionId && <a className="inline-flex font-medium text-primary underline-offset-4 hover:underline" href={`/api/admin/baremes-autonome/versions/${encodeURIComponent(sourceVersionId)}/source`}>{t('downloadSource')} <ArrowRight className="ml-1 size-4" /></a>}</> : <p className="text-muted-foreground">{t('notPresent')}</p>}</section>)}</div>
          </> : <p className="text-sm text-muted-foreground">{t('selectDifference')}</p>}
        </CardContent></Card>
      </section>
      {(issueSummary.length > 0 || workspace.coverage) && <Card className="border-amber-500/30"><CardContent className="space-y-2 p-4"><p className="font-medium">{t('coverageTitle')}</p><p className="text-sm text-muted-foreground">{t('readingScope')}</p>{workspace.coverage && <><p className="text-xs text-muted-foreground">{workspace.coverage.tables.map(table => t('coverageTable', { sheet: table.sheet, count: formatNumber(table.mappedCells, locale) })).join(' · ')}</p>{workspace.coverage.auxiliaryCells > 0 && <p className="text-sm text-muted-foreground">{t('auxiliaryCoverage', { count: formatNumber(workspace.coverage.auxiliaryCells, locale) })}</p>}</>}<details open={issueSummary.some((issue) => issue.blocking)}><summary className="cursor-pointer text-sm font-medium">{t('readingDetails', { count: issueSummary.length })}</summary><ul className="mt-2 list-inside list-disc text-sm">{issueSummary.map((issue, i) => <li key={`${issue.sheet}-${issue.cell}-${issue.code}-${i}`}>{t(issueTranslationKey(issue.code))} <span className="text-muted-foreground">({issue.sheet || t('workbook')}{issue.cell ? ` · ${issue.cell}` : ''})</span>{issue.blocking ? ` · ${t('blocking')}` : ''}</li>)}</ul></details></CardContent></Card>}
      <Card className="border-primary/20 bg-primary/[0.025]"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{t('readyTitle')}</h2></div><Button onClick={() => setConfirmOpen(true)} disabled={!workspace.canPublish || busy || loading || alreadyPublished}>{busy ? t('publishing') : t('publish')} <ArrowRight className="ml-2 size-4" /></Button></CardContent></Card>
    </>}
  </section>
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className="truncate text-sm font-medium tabular-nums">{value}</div></div> }
function VersionCard({ title, version, locale, tone }: { title: string; version: VersionRef | null; locale: Locale; tone: 'muted' }) {
  const t = useTranslations('admin.autonomousRates')
  return <Card className={tone === 'muted' ? 'bg-muted/20' : ''}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="size-5 text-muted-foreground" />{title}</CardTitle></CardHeader><CardContent>{version ? <><p className="truncate text-sm font-medium">{version.name}</p><p className="text-xs text-muted-foreground">{t('versionDate', { date: formatDate(version.createdAt, locale) })}</p><div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3"><Meta label={t('effectiveDate')} value={version.effectiveFrom ? formatDate(version.effectiveFrom, locale) : t('unknown')} /><Meta label={t('lineCount')} value={formatNumber(version.count, locale)} /></div></> : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t('noReference')}</p>}</CardContent></Card>
}
function KindBadge({ kind, label }: { kind: ChangeKind; label: string }) {
  const styles: Record<ChangeKind, string> = { modified: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', added: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', absent: 'border-destructive/30 bg-destructive/10 text-destructive', unchanged: 'border-border bg-muted text-muted-foreground' }
  return <Badge variant="outline" className={styles[kind]}>{label}</Badge>
}

const issueKeys = {
  PARSER_VERSION_OUTDATED: 'parserOutdated', INCOMPATIBLE_READING: 'incompatibleReading', ambiguous_table_header: 'ambiguousHeader', incomplete_rate_identities: 'incompleteIdentities', unknown_rate_row_identity: 'unknownRowIdentity', missing_rate_percentage: 'invalidPercentage', unknown_rate_percentage: 'invalidPercentage', ambiguous_rate_percentage: 'invalidPercentage', missing_index_multiplier: 'missingMultiplier', unmapped_daily_value: 'unmappedValue', unmapped_basis_value: 'unmappedValue', missing_basis_value: 'missingValue', missing_index_value: 'missingValue', missing_rate_value: 'missingValue', incomplete_rate_rows: 'incompleteIdentities', missing_expected_rate_code: 'incompleteIdentities', effective_date_mismatch: 'effectiveDateUnknown', unsupported_date_system: 'unsupportedDateSystem',
  COVERAGE_LOSS: 'coverageLoss', INVALID_EFFECTIVE_DATE: 'invalidEffectiveDate', identity_collision: 'identityCollision', missing_code_header: 'missingCodeHeader', unknown_rate_code: 'unknownRateCode', unknown_rate_column_context: 'unknownRateColumnContext', no_rate_columns: 'noRateColumns', formula_without_cached_result: 'formulaWithoutCachedResult', unknown_rate_value: 'unknownRateValue', missing_basis_headers: 'missingBasisHeaders', missing_index_headers: 'missingIndexHeaders', unknown_index_identity: 'unknownIndexIdentity', unknown_basis_identity: 'unknownBasisIdentity', unknown_basis_unit: 'unknownBasisUnit', required_sheet_missing: 'requiredSheetMissing', sheet_not_covered: 'sheetNotCovered', effective_date_unknown: 'effectiveDateUnknown',
} as const
type IssueMessage = (typeof issueKeys)[keyof typeof issueKeys] | 'generic'
function issueTranslationKey(code: string): `issues.${IssueMessage}` {
  const key: IssueMessage = issueKeys[code as keyof typeof issueKeys] ?? 'generic'
  return `issues.${key}`
}
