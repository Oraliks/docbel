'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDate } from '@/lib/i18n/format'
import type { Locale } from '@/i18n/locales'
import type { Difference, VersionRef, Workspace } from '@/lib/baremes-autonome/types'
import type { ReviewTask } from '@/lib/baremes-autonome/review-types'
import { ChangeValues, useRateLabels } from './value-view'
import { DifferenceDialog } from './difference-dialog'
import { ReviewDialog } from './review-dialog'

type History = { versions: VersionRef[]; publishedId: string | null }
type View = 'guided' | 'comparison' | 'themes'
const root = '/api/admin/baremes-autonome/versions'
export function BaremesAutonomeWorkspace() {
  const { t, e, label, number } = useRateLabels(),
    locale = useLocale() as Locale,
    router = useRouter(),
    params = useSearchParams(),
    requested = params.get('version') ?? ''
  const [history, setHistory] = useState<History>({ versions: [], publishedId: null }),
    [id, setId] = useState(requested),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [sheet, setSheet] = useState(''),
    [unchanged, setUnchanged] = useState(false),
    [view, setView] = useState<View>('guided'),
    [selected, setSelected] = useState<Difference | null>(null),
    [review, setReview] = useState<ReviewTask | null>(null),
    [confirm, setConfirm] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const request = useRef(0),
    abort = useRef<AbortController | null>(null),
    trigger = useRef<HTMLElement | null>(null)
  const loadHistory = useCallback(async () => {
    const response = await fetch(root, { cache: 'no-store' })
    if (!response.ok) throw new Error()
    const data = (await response.json()) as History
    setHistory(data)
    return data
  }, [])
  const load = useCallback(
    async (version: string) => {
      const sequence = ++request.current
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      setLoading(true)
      try {
        const filter = new URLSearchParams({ page: String(page), includeUnchanged: String(unchanged) })
        if (query.trim()) filter.set('q', query.trim())
        if (sheet) filter.set('sheet', sheet)
        const response = await fetch(`${root}/${version}?${filter}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const data = (await response.json()) as Workspace
        if (sequence !== request.current) return null
        setWorkspace(data)
        return true
      } catch (cause) {
        if (sequence !== request.current || (cause instanceof DOMException && cause.name === 'AbortError'))
          return null
        if (sequence === request.current && !(cause instanceof DOMException && cause.name === 'AbortError'))
          setError(t('errors.load'))
        return false
      } finally {
        if (sequence === request.current) setLoading(false)
      }
    },
    [page, query, sheet, unchanged, t],
  )
  useEffect(() => {
    void Promise.resolve()
      .then(() => loadHistory())
      .then((data) => {
        setId((current) => current || requested || data.versions[0]?.id || '')
        if (!data.versions.length) setLoading(false)
      })
      .catch(() => {
        setError(t('errors.load'))
        setLoading(false)
      })
  }, [loadHistory, requested, t])
  useEffect(() => {
    if (!id) return
    if (requested !== id)
      router.replace(`/admin/baremes-autonome?version=${encodeURIComponent(id)}`, { scroll: false })
    void Promise.resolve().then(() => load(id))
    return () => abort.current?.abort()
  }, [id, requested, router, load])
  const close = () => {
    setSelected(null)
    setReview(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  const openReview = (task: ReviewTask, element: HTMLElement) => {
    trigger.current = element
    setReview(task)
  }
  const refresh = async () => {
    setError('')
    const result = await Promise.allSettled([loadHistory(), id ? load(id) : Promise.resolve(true)])
    if (result.some((item) => item.status === 'rejected' || item.value === false)) throw new Error('refresh')
  }
  const upload = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError(t('errors.xlsxOnly'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(root, { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok || !data.id) throw new Error()
      setPage(1)
      setQuery('')
      setSheet('')
      setUnchanged(false)
      setSelected(null)
      setReview(null)
      setWorkspace(null)
      setId(data.id)
      try {
        await loadHistory()
      } catch {
        setError(t('refreshAfterImport'))
      }
    } catch {
      setError(t('errors.upload'))
    } finally {
      setBusy(false)
    }
  }
  const downloadReport = async () => {
    setError('')
    try {
      const response = await fetch(`${root}/${id}/report`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement('a')
      a.href = url
      a.download = `docbel-verification-${id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(e('reportError'))
    }
  }
  const publish = async () => {
    if (!workspace || busy) return
    setConfirm(false)
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${root}/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace.snapshot),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.code)
      }
    } catch (cause) {
      await load(id)
      setError(
        cause instanceof Error && cause.message === 'STALE_COMPARISON'
          ? t('errors.stale')
          : t('errors.publish'),
      )
      setBusy(false)
      return
    }
    setWorkspace((current) => (current ? { ...current, canPublish: false } : current))
    try {
      await refresh()
    } catch {
      setError(t('refreshAfterPublish'))
    } finally {
      setBusy(false)
    }
  }
  const state = workspace?.review,
    status = state?.availability ?? 'ready',
    pending = state?.pending ?? 0,
    changed = workspace ? workspace.counts.modified + workspace.counts.added + workspace.counts.absent : 0,
    first = !!workspace && !workspace.reference,
    pages = Math.max(1, Math.ceil((workspace?.total ?? 0) / 50)),
    step = !workspace ? 0 : workspace.candidate.publishedAt ? 2 : 1
  const imported = (
    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      <Upload className="size-4" />
      {t('importFile')}
      <input
        aria-label={t('importFile')}
        type="file"
        accept=".xlsx"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          void upload(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />
    </label>
  )
  return (
    <section
      aria-label={t('title')}
      aria-busy={loading || busy}
      className="w-full space-y-6 px-4 py-7 md:px-7"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <FileSpreadsheet className="size-5" />
            {t('title')}
            <Badge variant="secondary">{t('independentTool')}</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{e('title')}</h1>
          <p className="mt-2 text-muted-foreground">{e('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void refresh().catch(() => setError(t('errors.load')))}
        >
          <RefreshCw className="mr-2 size-4" />
          {t('refresh')}
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}
      <ol aria-label={t('stepsLabel')} className="grid grid-cols-3 gap-3">
        {(['import', 'review', 'publish'] as const).map((key, index) => (
          <li
            key={key}
            aria-current={step === index ? 'step' : undefined}
            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${step === index ? 'border-primary/40 bg-primary/5' : 'bg-card text-muted-foreground'}`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${step >= index ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {step > index ? <Check className="size-4" /> : index + 1}
            </span>
            {t(`steps.${key}`)}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-center">
        <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground">{e('beforeFile')}</span>
            <p className="break-words font-medium">{workspace?.reference?.name ?? e('noReference')}</p>
          </div>
          <ArrowRight aria-hidden className="hidden size-4 text-muted-foreground sm:block" />
          <div className="min-w-0">
            <span className="block text-xs text-muted-foreground">{e('afterFile')}</span>
            <p className="break-words font-medium">{workspace?.candidate.name ?? e('noFile')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t('historyLabel')}
            value={id}
            onChange={(event) => {
              setPage(1)
              setWorkspace(null)
              setId(event.target.value)
              setSelected(null)
              setReview(null)
            }}
            className="h-11 min-w-0 max-w-full flex-1 rounded-xl border bg-background px-3 text-sm lg:w-56"
          >
            <option value="">{t('chooseVersion')}</option>
            {history.versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.name} · {formatDate(version.createdAt, locale)}
              </option>
            ))}
          </select>
          {imported}
        </div>
      </div>
      {!workspace ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 p-8 text-center">
            <h2 className="text-xl font-semibold">{loading ? t('loading') : e('emptyTitle')}</h2>
            <p className="text-muted-foreground">{e('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <CardContent className="space-y-6 p-5 md:p-7">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">
                  {first
                    ? e(workspace.candidate.publishedAt ? 'states.published' : 'firstTitle')
                    : changed
                      ? e('changeTitle', { count: changed })
                      : e('noChanges')}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {first
                    ? e(workspace.candidate.publishedAt ? 'publishedBody' : 'firstBody')
                    : e('summary', {
                        modified: workspace.counts.modified,
                        added: workspace.counts.added,
                        absent: workspace.counts.absent,
                      })}
                </p>
              </div>
              <div className="text-sm">
                <span className="block text-muted-foreground">{t('effectiveDate')}</span>
                <strong>
                  {workspace.candidate.effectiveFrom
                    ? formatDate(workspace.candidate.effectiveFrom, locale)
                    : t('unknown')}
                </strong>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium">{e(`states.${status}`)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === 'review'
                  ? e('pendingSummary', { tasks: pending, rows: state?.affectedRows ?? 0 })
                  : status === 'technical'
                    ? e('technicalBody')
                    : status === 'future'
                      ? e('futureBody', {
                          date: workspace.candidate.effectiveFrom
                            ? formatDate(workspace.candidate.effectiveFrom, locale)
                            : t('unknown'),
                        })
                      : status === 'date'
                        ? e('dateBody')
                        : status === 'published'
                          ? e('publishedBody')
                          : e('readyBody')}
              </p>
              {state && state.accepted > 0 && (
                <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                  {e('acceptedCount', { count: state.accepted })}
                </p>
              )}
            </div>
            {!!state?.tasks.length && (
              <section aria-label={e('reviews')} className="space-y-2">
                {state.tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    disabled={!task.admissible}
                    onClick={(event) => openReview(task, event.currentTarget)}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-4 text-left text-sm hover:bg-muted/40 disabled:opacity-60 ${task.status === 'pending' ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30'}`}
                  >
                    <span>
                      <strong>
                        {e(
                          task.kind === 'removal'
                            ? 'removalTitle'
                            : task.kind === 'amount'
                              ? 'amountTitle'
                              : 'contextTitle',
                        )}
                      </strong>
                      <span className="mt-1 block text-muted-foreground">
                        {task.sheet} · {e('exactScope', { count: task.memberCount })}
                      </span>
                    </span>
                    <span>{e(task.status === 'accepted' ? 'accepted' : 'pending')} →</span>
                  </button>
                ))}
              </section>
            )}
            <nav aria-label={e('views')} className="flex flex-wrap gap-2 border-b pb-4">
              {(['guided', 'comparison', 'themes'] as const).map((key) => (
                <Button
                  key={key}
                  variant={view === key ? 'default' : 'outline'}
                  aria-pressed={view === key}
                  onClick={() => setView(key)}
                >
                  {e(`viewsList.${key}`)}
                </Button>
              ))}
            </nav>
            {view === 'themes' ? (
              <div className="grid gap-3 md:grid-cols-2">
                {state?.themes.map((theme) => (
                  <button
                    key={theme.sheet}
                    className="rounded-xl border p-5 text-left hover:bg-muted/30"
                    onClick={() => {
                      setSheet(theme.sheet)
                      setPage(1)
                      setView('guided')
                    }}
                  >
                    <h3 className="font-semibold">
                      {e.has(`themes.${theme.sheet}` as 'themes.A_N_B_vol_plein')
                        ? e(`themes.${theme.sheet}` as 'themes.A_N_B_vol_plein')
                        : theme.sheet}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {e('themeCount', {
                        changed: theme.changed,
                        total: theme.total,
                        pending: theme.pending,
                      })}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <Input
                    aria-label={t('searchPlaceholder')}
                    value={query}
                    placeholder={t('searchPlaceholder')}
                    className="min-w-40 flex-1"
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                  />
                  <select
                    aria-label={t('sheetLabel')}
                    value={sheet}
                    onChange={(event) => {
                      setSheet(event.target.value)
                      setPage(1)
                    }}
                    className="h-9 min-w-0 rounded-lg border bg-background px-3 text-sm"
                  >
                    <option value="">{t('allSheets')}</option>
                    {workspace.sheets.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={unchanged}
                      onChange={(event) => {
                        setUnchanged(event.target.checked)
                        setPage(1)
                      }}
                    />
                    {e('showUnchanged')}
                  </label>
                </div>
                <div className="max-h-[30rem] divide-y overflow-y-auto">
                  {workspace.items.map((row) => (
                    <button
                      key={row.key}
                      type="button"
                      onClick={(event) => {
                        trigger.current = event.currentTarget
                        setSelected(row)
                      }}
                      className={`grid w-full gap-4 rounded-lg py-5 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === 'comparison' ? 'md:grid-cols-[1fr_1.2fr]' : 'md:grid-cols-[1.2fr_1fr]'}`}
                    >
                      <div>
                        <h3 className="font-medium">{label((row.after ?? row.before)!)}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {(row.after ?? row.before)!.context.slice(0, 3).join(' · ')}
                        </p>
                        <span className="mt-2 inline-block text-xs text-primary">
                          {t(`kinds.${row.kind}`)} · {e('understand')}
                        </span>
                      </div>
                      <ChangeValues row={row} />
                    </button>
                  ))}
                </div>
                {!workspace.items.length && (
                  <p className="py-8 text-center text-muted-foreground">
                    {loading ? t('loading') : e('noResults')}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{t('resultCount', { count: number(String(workspace.total)) })}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={t('previousPage')}
                      disabled={page <= 1 || loading}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span>{t('pageOf', { page, pages })}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={t('nextPage')}
                      disabled={page >= pages || loading}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer text-sm font-medium">{e('readingReport')}</summary>
              <p className="my-3 text-sm text-muted-foreground">
                {e('readingCount', {
                  count: workspace.candidate.count,
                  threshold: state?.thresholdPercent ?? '20',
                })}
              </p>
              <ul className="space-y-2 text-sm">
                {workspace.issues.map((issue, index) => (
                  <li key={index} className={issue.blocking ? 'text-destructive' : 'text-muted-foreground'}>
                    {e(issue.blocking ? 'technicalIssue' : 'scopeObservation')} · {issue.sheet}
                    {issue.cell ? ` · ${issue.cell}` : ''}
                    <code className="ml-2 text-xs">{issue.code}</code>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4" onClick={() => void downloadReport()}>
                {e('downloadReport')}
              </Button>
            </details>
            <footer className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{e('independent')}</p>
              <Button
                className="h-12 shrink-0 rounded-xl px-6"
                disabled={busy || loading || ['future', 'date', 'published'].includes(status)}
                onClick={(event) => {
                  if (status === 'technical') {
                    void downloadReport()
                    return
                  }
                  const next = state?.tasks.find((task) => task.status === 'pending')
                  if (next) {
                    openReview(next, event.currentTarget)
                    return
                  }
                  setConfirm(true)
                }}
              >
                {e(
                  status === 'technical'
                    ? 'downloadReport'
                    : status === 'review'
                      ? 'nextReview'
                      : status === 'future'
                        ? 'waitDate'
                        : status === 'date'
                          ? 'dateAction'
                          : status === 'published'
                            ? 'publishedAction'
                            : 'publishAction',
                )}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </footer>
          </CardContent>
        </Card>
      )}
      {workspace && selected && <DifferenceDialog row={selected} workspace={workspace} onClose={close} />}
      {workspace && review && (
        <ReviewDialog
          key={review.id}
          task={review}
          workspace={workspace}
          onClose={close}
          onSaved={async () => {
            await refresh()
          }}
        />
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('publishConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {e('publishBody', { changes: changed, accepted: state?.accepted ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || loading || !workspace?.canPublish}
              onClick={() => void publish()}
            >
              {e('publishAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
