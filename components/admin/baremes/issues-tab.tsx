'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Download, Info, OctagonAlert, XCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDateTime } from '@/lib/i18n/format'
import { toast } from 'sonner'
import type { BaremeComparisonSnapshot, BaremeStructuredProblem } from '@/lib/baremes/types'

export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface IssueItem {
  level: 'info' | 'warn' | 'error'
  message: string
  sheet?: string
  cell?: string
  severity?: IssueSeverity
  kind?: string
  title?: string
  row?: number
  column?: string
  rawValue?: string
  reason?: string
  recommendation?: string
  problem?: BaremeStructuredProblem
}

export function effectiveSeverity(issue: IssueItem): IssueSeverity {
  if (issue.severity) return issue.severity
  if (issue.level === 'warn') return 'warning'
  return issue.level
}

const SEVERITY_ORDER: IssueSeverity[] = ['critical', 'error', 'warning', 'info']

const SEVERITY_STYLE: Record<IssueSeverity, { icon: React.ReactNode; badge: string }> = {
  critical: {
    icon: <OctagonAlert className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />,
    badge: 'bg-red-200 text-red-950 border-red-400',
  },
  error: {
    icon: <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
    badge: 'bg-red-100 text-red-900 border-red-300',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />,
    badge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />,
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
  },
}

/**
 * Onglet "Erreurs & warnings" : liste complète des issues d'import avec
 * gravité, localisation (feuille/cellule), valeur brute, raison et action
 * recommandée. Filtrable par gravité et par feuille, rapport téléchargeable.
 */
export function IssuesTab({ issues, fileId, comparison, onConfirmed }: { issues: IssueItem[]; fileId: string; comparison: BaremeComparisonSnapshot | null; onConfirmed: () => Promise<void> }) {
  const t = useTranslations('admin.baremes')
  const locale = useLocale()
  const [severityFilter, setSeverityFilter] = useState('')
  const [sheetFilter, setSheetFilter] = useState('')

  const sheets = useMemo(
    () => [...new Set(issues.map((i) => i.sheet).filter(Boolean))].sort() as string[],
    [issues]
  )
  const counts = useMemo(() => {
    const c: Record<IssueSeverity, number> = { critical: 0, error: 0, warning: 0, info: 0 }
    for (const i of issues) c[effectiveSeverity(i)]++
    return c
  }, [issues])

  const filtered = useMemo(
    () =>
      issues
        .filter((i) => (severityFilter ? effectiveSeverity(i) === severityFilter : true))
        .filter((i) => (sheetFilter ? i.sheet === sheetFilter : true))
        .sort(
          (a, b) =>
            SEVERITY_ORDER.indexOf(effectiveSeverity(a)) - SEVERITY_ORDER.indexOf(effectiveSeverity(b))
        ),
    [issues, severityFilter, sheetFilter]
  )

  const groups = useMemo(() => {
    const grouped = new Map<string, { category: string; severity: IssueSeverity; items: IssueItem[]; problem?: IssueItem['problem'] }>()
    for (const issue of filtered) {
      const problem = issue.problem
      const category = problem?.category ?? issue.kind ?? 'legacy'
      // Group by structured cause, never by interpreting the diagnostic text.
      const key = problem ? problem.groupId : `legacy:${category}:${effectiveSeverity(issue)}`
      const group = grouped.get(key) ?? { category, severity: problem?.severity ?? effectiveSeverity(issue), items: [], problem }
      group.items.push(issue)
      grouped.set(key, group)
    }
    return [...grouped.values()]
  }, [filtered])

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('alertsNone')}
        </CardContent>
      </Card>
    )
  }

  const selectCls = 'text-xs border rounded-md px-2 py-1.5 bg-background'

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className={selectCls}
            aria-label={t('filterSeverity')}
          >
            <option value="">{t('filterSeverityAll')}</option>
            {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <option key={s} value={s}>
                {t(`severity_${s}`)} ({counts[s]})
              </option>
            ))}
          </select>
          {sheets.length > 0 && (
            <select
              value={sheetFilter}
              onChange={(e) => setSheetFilter(e.target.value)}
              className={selectCls}
              aria-label={t('filterSheet')}
            >
              <option value="">{t('filterSheetAll')}</option>
              {sheets.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/baremes/import/${fileId}/export?type=report`, '_blank')}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {t('downloadReport')}
          </Button>
        </div>

        <div className="space-y-6">
          {(['critical', 'error', 'warning', 'info'] as IssueSeverity[]).map((severity) => {
            const sectionGroups = groups.filter((group) => group.severity === severity)
            if (!sectionGroups.length) return null
            const sectionKey = severity === 'critical' || severity === 'error' ? 'problemsToFix' : severity === 'warning' ? 'problemsToReview' : 'problemsInformation'
            return <section key={severity} aria-labelledby={`issues-${severity}`} className="space-y-3">
              <h3 id={`issues-${severity}`} className="text-base font-semibold">{t(sectionKey as Parameters<typeof t>[0])} <span className="text-sm font-normal text-muted-foreground">({sectionGroups.reduce((count, group) => count + group.items.length, 0)} · {sectionGroups.length} {t('problemGroups')})</span></h3>
              {sectionGroups.map((group) => <Card key={`${severity}-${group.problem?.groupId ?? group.category}-${group.items[0]?.problem?.id ?? 'legacy'}`}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-medium">{group.items[0].title ?? group.items[0].message}</p>
                      <p className="text-xs text-muted-foreground">{group.problem ? <>{t(`problemOwner_${group.problem.owner}` as Parameters<typeof t>[0])} · {t(`problemResolution_${group.problem.resolutionState}` as Parameters<typeof t>[0])} · {t('problemCategoryLabel')}: {group.category} · {group.problem.affectedCount} {t('problemElements')}</> : t('historicProblemNoDecision')} · {group.items.length} {t('problemAlerts')}</p>
                    </div>
                    {group.problem?.publicationEffect === 'blocking' && <span className="rounded border px-2 py-1 text-xs font-medium text-destructive">{t('problemBlocksPublication')}</span>}
                    {group.problem?.publicationEffect === 'review' && <span className="rounded border px-2 py-1 text-xs font-medium">{t('problemNeedsReview')}</span>}
                  </div>
                  {group.problem?.resolution && <div className="rounded-md bg-muted/50 p-3 text-sm" role="status"><p className="font-medium">{t('problemConfirmedBy', { actor: group.problem.resolution.actorEmail, date: formatDateTime(group.problem.resolution.confirmedAt, locale) })}</p><p className="mt-1">{group.problem.resolution.reason}</p><p className="mt-1 text-xs text-muted-foreground">{t('problemReviewedKeys', { count: group.problem.resolution.reviewedKeys.length })}</p></div>}
                  {group.problem?.allowedActions.includes('confirm_change') && group.problem.resolutionState !== 'confirmed' && <ConfirmationForm fileId={fileId} problem={group.problem} comparison={comparison} disabled={!comparison || comparison.state !== 'computed'} onConfirmed={onConfirmed} />}
                  <ul className="space-y-2">
                    {group.items.map((issue, i) => {
            const sev = effectiveSeverity(issue)
            const style = SEVERITY_STYLE[sev]
            return (
              <li key={`${issue.problem?.id ?? group.category}-${issue.sheet ?? ''}-${issue.cell ?? ''}-${i}`} className="flex items-start gap-2.5 text-sm border rounded-md p-3">
                {style.icon}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {t(`severity_${sev}`)}
                    </span>
                    {issue.kind && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {issue.kind}
                      </span>
                    )}
                    <span className="font-medium">{issue.title ?? issue.message}</span>
                  </div>
                  {issue.reason && issue.title && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{issue.reason}</p>
                  )}
                  {!issue.title && !issue.reason && issue.message && issue.title !== issue.message && null}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
                    {issue.sheet && <span>{t('issueSheet')}: {issue.sheet}</span>}
                    {issue.cell && <span>{t('issueCell')}: {issue.cell}</span>}
                    {issue.row != null && !issue.cell && <span>{t('issueRow')}: {issue.row}</span>}
                    {issue.rawValue && <span>{t('issueRawValue')}: « {issue.rawValue} »</span>}
                  </div>
                  {issue.recommendation && (
                    <p className="text-xs bg-muted/50 border-l-2 border-primary/40 pl-2 py-1 rounded-r">
                      <span className="font-medium">{t('issueRecommendation')} :</span>{' '}
                      {issue.recommendation}
                    </p>
                  )}
                  {issue.problem?.evidence?.map((evidence, evidenceIndex) => <div key={evidenceIndex} className="text-xs text-muted-foreground">{evidence.comparisonKey ? <p>{t('diffColKey')}: <span className="font-mono">{evidence.comparisonKey}</span></p> : null}{evidence.oldSource && <p>{t('comparisonBefore')}: {evidence.oldSource.sheet} · {evidence.oldSource.cell} · {evidence.oldSource.rawValue}{evidence.oldSource.unit ? ` ${evidence.oldSource.unit}` : ''}</p>}{evidence.newSource && <p>{t('comparisonAfter')}: {evidence.newSource.sheet} · {evidence.newSource.cell} · {evidence.newSource.rawValue}{evidence.newSource.unit ? ` ${evidence.newSource.unit}` : ''}</p>}{!evidence.oldSource && !evidence.newSource && <p>{evidence.sheet ?? issue.sheet ?? '—'}{evidence.cell ?? issue.cell ? ` · ${evidence.cell ?? issue.cell}` : ''}{evidence.rawValue ? ` · ${evidence.rawValue}` : ''}</p>}</div>)}
                  {issue.problem?.allowedActions.includes('open_source') && <a className="inline-flex rounded text-xs text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/api/baremes/import/${fileId}/source`} target="_blank" rel="noreferrer">{t('openOriginalSource')}</a>}
                </div>
              </li>
            )
                    })}
                  </ul>
                </CardContent>
              </Card>)}
            </section>
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ConfirmationForm({ fileId, problem, comparison, disabled, onConfirmed }: { fileId: string; problem: BaremeStructuredProblem; comparison: BaremeComparisonSnapshot | null; disabled: boolean; onConfirmed: () => Promise<void> }) {
  const t = useTranslations('admin.baremes')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const canSubmit = !disabled && reason.trim().length >= 20 && reason.trim().length <= 2000 && !saving
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !comparison) return
    setSaving(true)
    try {
      const response = await fetch(`/api/baremes/import/${fileId}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problemId: problem.id, reason: reason.trim(), comparison }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? t('problemConfirmationFailed'))
      toast.success(t('problemConfirmationSaved'))
      await onConfirmed()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('error'))
    } finally {
      setSaving(false)
    }
  }
  return <form onSubmit={submit} className="rounded-md border p-3 space-y-2">
    <label htmlFor={`confirm-reason-${problem.id}`} className="block text-sm font-medium">{t('problemConfirmationReason')}</label>
    <textarea id={`confirm-reason-${problem.id}`} className="min-h-24 w-full rounded-md border bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" minLength={20} maxLength={2000} required value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby={`confirm-hint-${problem.id}`} />
    <p id={`confirm-hint-${problem.id}`} className="text-xs text-muted-foreground">{t(disabled ? 'problemConfirmationNeedsComparison' : 'problemConfirmationHint')}</p>
    <Button type="submit" size="sm" disabled={!canSubmit}>{saving ? t('saving') : t('confirmRealChange')}</Button>
  </form>
}
