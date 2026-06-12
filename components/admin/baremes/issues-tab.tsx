'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Download, Info, OctagonAlert, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

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
export function IssuesTab({ issues, fileId }: { issues: IssueItem[]; fileId: string }) {
  const t = useTranslations('admin.baremes')
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

        <ul className="space-y-3">
          {filtered.map((issue, i) => {
            const sev = effectiveSeverity(issue)
            const style = SEVERITY_STYLE[sev]
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm border rounded-md p-3">
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
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
