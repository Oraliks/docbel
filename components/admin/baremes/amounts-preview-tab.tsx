'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Info, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export type RowStatus = 'valid' | 'warning' | 'ignored' | 'error' | 'unknown'

export interface AmountTrace {
  sourceCell: string
  sourceRowIndex: number
  sourceColumnIndex: number
  rawValue: string
  normalizedValue: number | string | null
  mappingKey?: string | null
  mappingFile?: string | null
  transformTemplate?: string | null
  transformReason?: string | null
}

export interface AmountItem {
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
  status: RowStatus
  warnings: string[]
  trace: AmountTrace | null
}

interface Facets {
  sheets: string[]
  codes: string[]
  statusCounts: Record<string, number>
}

const PAGE_SIZE = 100

export function StatusBadge({ status }: { status: RowStatus }) {
  const t = useTranslations('admin.baremes')
  const config: Record<RowStatus, { label: string; cls: string }> = {
    valid: { label: t('rowStatusValid'), cls: 'bg-green-100 text-green-900 border-green-300' },
    warning: { label: t('rowStatusWarning'), cls: 'bg-yellow-100 text-yellow-900 border-yellow-300' },
    unknown: { label: t('rowStatusUnknown'), cls: 'bg-orange-100 text-orange-900 border-orange-300' },
    ignored: { label: t('rowStatusIgnored'), cls: 'bg-muted text-muted-foreground border-border' },
    error: { label: t('rowStatusBlocking'), cls: 'bg-red-100 text-red-900 border-red-300' },
  }
  const c = config[status] ?? config.valid
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border whitespace-nowrap ${c.cls}`}>
      {c.label}
    </span>
  )
}

/** Popover « provenance » : explique d'où vient la ligne, cellule par cellule. */
export function TracePopover({ item }: { item: AmountItem }) {
  const t = useTranslations('admin.baremes')
  if (!item.trace) {
    return <span className="text-muted-foreground text-xs">—</span>
  }
  const tr = item.trace
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('traceOpen')}
        >
          <Info className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 text-xs space-y-2" align="start">
        {tr.transformReason && <p className="leading-relaxed">{tr.transformReason}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2 border-t font-mono text-[11px]">
          <dt className="text-muted-foreground">{t('traceCell')}</dt>
          <dd>{item.sourceSheet}!{tr.sourceCell}</dd>
          <dt className="text-muted-foreground">{t('traceRaw')}</dt>
          <dd className="break-all">« {tr.rawValue} »</dd>
          <dt className="text-muted-foreground">{t('traceNormalized')}</dt>
          <dd>{tr.normalizedValue ?? '—'}</dd>
          {tr.mappingKey && (
            <>
              <dt className="text-muted-foreground">{t('traceMappingKey')}</dt>
              <dd>{tr.mappingKey}</dd>
            </>
          )}
          {tr.mappingFile && (
            <>
              <dt className="text-muted-foreground">{t('traceMappingFile')}</dt>
              <dd>{tr.mappingFile}</dd>
            </>
          )}
          {tr.transformTemplate && (
            <>
              <dt className="text-muted-foreground">{t('traceTemplate')}</dt>
              <dd>{tr.transformTemplate}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('traceKey')}</dt>
          <dd className="break-all">{item.comparisonKey}</dd>
        </dl>
        {item.warnings.length > 0 && (
          <ul className="pt-2 border-t space-y-1">
            {item.warnings.map((w, i) => (
              <li key={i} className="text-yellow-700 dark:text-yellow-400">⚠ {w}</li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Preview filtrable d'un groupe de montants (allocations / tranches / montants de base).
 * Chaque ligne porte son badge de statut et son popover de provenance.
 */
export function AmountsPreviewTab({
  fileId,
  group,
  exportAllowed,
}: {
  fileId: string
  group: 'allocations' | 'tranches' | 'montants-base'
  exportAllowed: boolean
}) {
  const t = useTranslations('admin.baremes')
  const [items, setItems] = useState<AmountItem[]>([])
  const [facets, setFacets] = useState<Facets | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ group, page: String(page), pageSize: String(PAGE_SIZE) })
      if (sheet) params.set('sheet', sheet)
      if (code) params.set('code', code)
      if (status) params.set('status', status)
      if (q.trim()) params.set('q', q.trim())
      const res = await fetch(`/api/baremes/import/${fileId}/amounts?${params}`)
      if (!res.ok) throw new Error(t('loadError'))
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setFacets(data.facets)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }, [fileId, group, page, sheet, code, status, q, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectCls =
    'text-xs border rounded-md px-2 py-1.5 bg-background max-w-[180px]'

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sheet}
            onChange={(e) => { setSheet(e.target.value); setPage(1) }}
            className={selectCls}
            aria-label={t('filterSheet')}
          >
            <option value="">{t('filterSheetAll')}</option>
            {facets?.sheets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(facets?.codes.length ?? 0) > 0 && (
            <select
              value={code}
              onChange={(e) => { setCode(e.target.value); setPage(1) }}
              className={selectCls}
              aria-label={t('filterCode')}
            >
              <option value="">{t('filterCodeAll')}</option>
              {facets?.codes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className={selectCls}
            aria-label={t('filterStatus')}
          >
            <option value="">{t('filterStatusAll')}</option>
            {Object.entries(facets?.statusCounts ?? {}).map(([s, n]) => (
              <option key={s} value={s}>{s} ({n})</option>
            ))}
          </select>
          <input
            type="search"
            placeholder={t('filterSearch')}
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="text-xs border rounded-md px-2 py-1.5 bg-background w-48"
          />
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            disabled={!exportAllowed}
            title={exportAllowed ? undefined : t('exportBlockedTooltip')}
            onClick={() => window.open(`/api/baremes/import/${fileId}/export?type=${group}`, '_blank')}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {t('downloadCsv')}
          </Button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">{t('amountsNone')}</p>
        ) : (
          <>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 w-8" aria-label={t('traceOpen')} />
                    <th className="text-left px-2 py-2">{t('rowStatusCol')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColSheet')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColAllocCode')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColBracket')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColArticle')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColLabel')}</th>
                    <th className="text-right px-2 py-2">{t('amountsColAmount')}</th>
                    <th className="text-left px-2 py-2">{t('amountsColUnit')}</th>
                    <th className="text-left px-2 py-2">{t('traceCellCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5"><TracePopover item={a} /></td>
                      <td className="px-2 py-1.5"><StatusBadge status={a.status} /></td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{a.sourceSheet}</td>
                      <td className="px-2 py-1.5 font-mono">{a.allocationCode ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">
                        {a.salaryCode ?? '—'}
                        {a.minDailySalary != null && a.maxDailySalary != null && (
                          <span className="text-muted-foreground ml-1">
                            ({a.minDailySalary.toFixed(2)}–{a.maxDailySalary.toFixed(2)})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 max-w-[160px] truncate" title={a.article ?? undefined}>
                        {a.article ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 max-w-[220px] truncate" title={a.labelFr ?? a.labelNl ?? undefined}>
                        {a.labelFr ?? a.labelNl ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">{a.amount.toFixed(4)}</td>
                      <td className="px-2 py-1.5">{a.unit ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">
                        {a.trace?.sourceCell ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('paginationTotal', { total: total.toLocaleString('fr-BE') })}</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ←
                  </Button>
                  <span>{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    →
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
