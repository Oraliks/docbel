'use client'

import { Fragment, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
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
import { ChevronDown, ChevronRight, Minus, Plus, StickyNote } from 'lucide-react'
import { getModuleInfo } from '@/lib/lookup/modules'
import { cleanTableLabel } from '@/lib/lookup/cleanTableLabel'
import { FlagPrefix } from './flag-prefix'
import { DetailPanel } from './detail-panel'
import type { ColumnKey, ResultGroup, SearchResult } from './types'

interface Props {
  group: ResultGroup
  collapsed: boolean
  onToggleCollapse: () => void
  visibleCols: Set<ColumnKey>
  expandedIds: Set<string>
  onToggleRow: (id: string) => void
  highlight: (s: string) => ReactNode
  activeTableSlug: string
  onPickOnly: (slug: string) => void
}

/** Une section = une table source + ses lignes. Collapsible via le header. */
export function ResultSection({
  group,
  collapsed,
  onToggleCollapse,
  visibleCols,
  expandedIds,
  onToggleRow,
  highlight,
  activeTableSlug,
  onPickOnly,
}: Props) {
  const t = useTranslations('public.outils')
  const isVisible = (k: ColumnKey) => visibleCols.has(k)
  const colSpan =
    (isVisible('code') ? 1 : 0) +
    (isVisible('fr') ? 1 : 0) +
    (isVisible('validity') ? 1 : 0) +
    (isVisible('notes') ? 1 : 0) +
    (isVisible('source') ? 1 : 0)
  // On préfère le label du module (S04/S36 → "Admissibilité / Complément")
  // à la catégorie DB qui est historique et parfois inexacte (ex: tables
  // S04/S36 rangées dans "Signalétique" dans le seed).
  const moduleInfo = getModuleInfo(group.tablePrefix)
  const displayLabel = cleanTableLabel(group.tableLabel, group.tablePrefix)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <Badge variant="outline" className="font-mono text-[10px] shrink-0">
            {group.tablePrefix}
          </Badge>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{displayLabel}</div>
            <div className="text-[11px] text-muted-foreground truncate">{moduleInfo.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('lkpResResultsLabel', { count: group.rows.length })}
          </span>
          {activeTableSlug !== group.tableSlug && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onPickOnly(group.tableSlug)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onPickOnly(group.tableSlug)
                }
              }}
              className="text-[11px] text-primary hover:underline cursor-pointer"
            >
              {t('lkpResOnlyThisModule')}
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9" aria-label={t('lkpResColDetailsAria')} />
                  {isVisible('code') && <TableHead className="w-32">{t('lkpResColCode')}</TableHead>}
                  {isVisible('fr') && <TableHead>{t('lkpResColDescription')}</TableHead>}
                  {isVisible('validity') && <TableHead className="w-44 text-xs">{t('lkpResColValidity')}</TableHead>}
                  {isVisible('notes') && <TableHead className="w-12">{t('lkpResColNote')}</TableHead>}
                  {isVisible('source') && <TableHead className="w-64">{t('lkpResColSourceOnem')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((r) => (
                  <ResultRow
                    key={r.id}
                    row={r}
                    open={expandedIds.has(r.id)}
                    onToggle={() => onToggleRow(r.id)}
                    visibleCols={visibleCols}
                    highlight={highlight}
                    colSpan={colSpan}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

interface RowProps {
  row: SearchResult
  open: boolean
  onToggle: () => void
  visibleCols: Set<ColumnKey>
  highlight: (s: string) => ReactNode
  colSpan: number
}

function ResultRow({ row, open, onToggle, visibleCols, highlight, colSpan }: RowProps) {
  const t = useTranslations('public.outils')
  const isVisible = (k: ColumnKey) => visibleCols.has(k)
  const detailCount =
    (row.metadata ? Object.keys(row.metadata).length : 0) +
    (row.labelNl ? 1 : 0) +
    (row.labelDe ? 1 : 0) +
    (row.labelEn ? 1 : 0) +
    (row.notes ? 1 : 0)
  const hasDetails = detailCount > 0
  const isExpired = row.validUntil && new Date(row.validUntil) < new Date()

  return (
    <Fragment>
      <TableRow
        onClick={() => hasDetails && onToggle()}
        className={hasDetails ? 'cursor-pointer' : ''}
        aria-expanded={hasDetails ? open : undefined}
      >
        <TableCell className="w-9 align-top">
          {hasDetails ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="inline-flex items-center justify-center w-6 h-6 rounded border border-input bg-background hover:bg-muted transition-colors"
              aria-label={open ? t('lkpResAriaCollapse') : t('lkpResAriaMoreInfo', { count: detailCount })}
              title={open ? t('lkpResAriaCollapse') : t('lkpResAriaMoreInfo', { count: detailCount })}
            >
              {open ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
          ) : (
            <span className="text-muted-foreground/30 text-xs">—</span>
          )}
        </TableCell>
        {isVisible('code') && (
          <TableCell className="font-mono text-xs align-top">{highlight(row.code)}</TableCell>
        )}
        {isVisible('fr') && (
          <TableCell className="text-sm align-top">
            <FlagPrefix tableSlug={row.table.slug} label={row.labelFr} />
            {highlight(row.labelFr)}
            {isExpired && (
              <Badge variant="outline" className="ml-2 text-[10px] border-orange-300 text-orange-800">
                {t('lkpResHistorical')}
              </Badge>
            )}
          </TableCell>
        )}
        {isVisible('validity') && (
          <TableCell className="text-xs text-muted-foreground align-top">
            <div>{row.validFrom ? new Date(row.validFrom).toLocaleDateString('fr-BE') : '—'}</div>
            <div>
              {row.validUntil ? (
                <span className="text-orange-700">
                  {t('lkpResUntilDate', { date: new Date(row.validUntil).toLocaleDateString('fr-BE') })}
                </span>
              ) : (
                <span className="text-green-700">{t('lkpResInForce')}</span>
              )}
            </div>
          </TableCell>
        )}
        {isVisible('notes') && (
          <TableCell className="text-center align-top">
            {row.notes ? (
              <span title={row.notes}>
                <StickyNote className="w-4 h-4 text-yellow-600 inline" />
              </span>
            ) : (
              <span className="text-muted-foreground/30">—</span>
            )}
          </TableCell>
        )}
        {isVisible('source') && (
          <TableCell className="text-xs align-top">
            <Badge variant="outline" className="font-mono text-[10px] mr-2">
              {row.table.prefix}
            </Badge>
            <span>{row.table.category.labelFr}</span>
            <div className="text-muted-foreground text-[10px] mt-0.5">{row.table.labelFr}</div>
          </TableCell>
        )}
      </TableRow>
      {open && hasDetails && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={colSpan} className="py-3">
            <DetailPanel result={row} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}
