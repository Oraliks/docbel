'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

export interface DiagnosticsPayload {
  fileSize?: number
  unknownCodes: { sheet: string; cell: string; code: string; category?: string; recommendation?: string }[]
  ignoredRows: { sheet: string; rowIndex: number; rawValues: string[]; reason: string }[]
  unsupportedSheets: { name: string; reason: string; rowCount?: number }[]
  partialSheets: { name: string; reason: string }[]
  sheetPeriods: { sheet: string; detectedDate: string | null; matchesFile: boolean | null }[]
  duplicates: { comparisonKey: string; count: number; droppedCells: string[] }[]
  ignoredRowsTruncated?: boolean
}

/**
 * Onglet "Diagnostic développeur" : tout ce qu'il faut pour corriger les
 * mappings côté code — codes inconnus (avec suggestion code-mapping.ts /
 * ignored-codes.ts), lignes ignorées, feuilles non supportées (avec preview
 * brute), périodes par feuille, doublons, grilles brutes complètes.
 */
export function DiagnosticTab({
  fileId,
  diagnostics,
}: {
  fileId: string
  diagnostics: DiagnosticsPayload | null
}) {
  const t = useTranslations('admin.baremes')

  const dl = (type: string) =>
    window.open(`/api/baremes/import/${fileId}/export?type=${type}`, '_blank')

  if (!diagnostics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t('diagNone')}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Codes inconnus */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            {t('diagUnknownCodes')} ({diagnostics.unknownCodes.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => dl('unknown-codes')}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            unknown-codes.json
          </Button>
        </CardHeader>
        <CardContent>
          {diagnostics.unknownCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('diagUnknownCodesNone')}</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">{t('issueSheet')}</th>
                    <th className="text-left px-3 py-2">{t('issueCell')}</th>
                    <th className="text-left px-3 py-2">Code</th>
                    <th className="text-left px-3 py-2">{t('issueRecommendation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.unknownCodes.map((u, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{u.sheet}</td>
                      <td className="px-3 py-1.5 font-mono">{u.cell}</td>
                      <td className="px-3 py-1.5 font-mono font-semibold">{u.code}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{u.recommendation ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lignes ignorées */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">
            {t('diagIgnoredRows')} ({diagnostics.ignoredRows.length}
            {diagnostics.ignoredRowsTruncated ? '+' : ''})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => dl('ignored-rows')}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            ignored-rows.csv
          </Button>
        </CardHeader>
        <CardContent>
          {diagnostics.ignoredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('diagIgnoredRowsNone')}</p>
          ) : (
            <div className="border rounded-md overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">{t('issueSheet')}</th>
                    <th className="text-right px-3 py-2">{t('issueRow')}</th>
                    <th className="text-left px-3 py-2">{t('diagReason')}</th>
                    <th className="text-left px-3 py-2">{t('diagRowPreview')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.ignoredRows.map((r, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="px-3 py-1.5 font-mono whitespace-nowrap">{r.sheet}</td>
                      <td className="px-3 py-1.5 font-mono text-right">{r.rowIndex}</td>
                      <td className="px-3 py-1.5">{r.reason}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground max-w-[300px] truncate">
                        {r.rawValues.filter(Boolean).join(' | ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {diagnostics.ignoredRowsTruncated && (
            <p className="text-xs text-muted-foreground mt-2">{t('diagIgnoredRowsTruncated')}</p>
          )}
        </CardContent>
      </Card>

      {/* Feuilles non supportées + périodes + doublons en grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              {t('diagUnsupportedSheets')} ({diagnostics.unsupportedSheets.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => dl('unsupported-sheets')}>
                <Download className="w-3.5 h-3.5 mr-1" />
                .json
              </Button>
              <Button variant="outline" size="sm" onClick={() => dl('raw-preview')}>
                <Download className="w-3.5 h-3.5 mr-1" />
                raw-preview.json
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {diagnostics.unsupportedSheets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('diagUnsupportedNone')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {diagnostics.unsupportedSheets.map((s) => (
                  <li key={s.name} className="border rounded-md p-2">
                    <div className="font-mono text-xs font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.reason}
                      {s.rowCount != null && ` · ${s.rowCount} ${t('diagRows')}`}
                    </div>
                    <div className="text-xs mt-1 bg-muted/50 border-l-2 border-primary/40 pl-2 py-0.5 rounded-r">
                      {t('diagUnsupportedHint')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('diagSheetPeriods')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">{t('issueSheet')}</th>
                    <th className="text-left px-3 py-2">{t('diagDetectedDate')}</th>
                    <th className="text-left px-3 py-2">{t('diagMatchesFile')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.sheetPeriods.map((p) => (
                    <tr key={p.sheet} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{p.sheet}</td>
                      <td className="px-3 py-1.5 font-mono">{p.detectedDate ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        {p.matchesFile === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : p.matchesFile ? (
                          <span className="text-green-700">✓</span>
                        ) : (
                          <span className="text-yellow-700 font-medium">{t('diagPeriodDiffers')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doublons */}
      {diagnostics.duplicates.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t('diagDuplicates')} ({diagnostics.duplicates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">{t('diffColKey')}</th>
                    <th className="text-right px-3 py-2">{t('diagOccurrences')}</th>
                    <th className="text-left px-3 py-2">{t('diagDroppedCells')}</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.duplicates.map((d) => (
                    <tr key={d.comparisonKey} className="border-t">
                      <td className="px-3 py-1.5 font-mono">{d.comparisonKey}</td>
                      <td className="px-3 py-1.5 font-mono text-right">{d.count}</td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">
                        {d.droppedCells.join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grilles brutes complètes (toutes feuilles) */}
      <RawSheetsPanel fileId={fileId} />
    </div>
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

export function RawSheetsPanel({ fileId }: { fileId: string }) {
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
