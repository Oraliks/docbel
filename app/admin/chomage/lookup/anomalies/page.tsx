'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface Anomaly {
  type: string
  severity: 'info' | 'warn' | 'error'
  tableId: string
  tableSlug: string
  tableLabelFr: string
  count: number
  details?: string
  examples?: { code: string; labelFr: string }[]
}

interface Report {
  generatedAt: string
  totalEntries: number
  totalTables: number
  anomalies: Anomaly[]
  summary: { error: number; warn: number; info: number }
}

const SEVERITY_LABEL: Record<string, { label: string; icon: typeof Info; tone: string }> = {
  error: { label: 'Erreur', icon: AlertCircle, tone: 'text-red-600' },
  warn: { label: 'Avertissement', icon: AlertTriangle, tone: 'text-orange-600' },
  info: { label: 'Info', icon: Info, tone: 'text-blue-600' },
}

const TYPE_LABEL: Record<string, string> = {
  duplicate_code: 'Codes en multiples versions',
  duplicate_label: 'Libellés FR partagés par plusieurs codes',
  missing_fr: 'Label FR manquant',
  missing_nl: 'Label NL manquant',
  expired: 'Entrées expirées (validUntil dépassée)',
  empty_table: 'Tables sans entrées',
}

export default function LookupAnomaliesPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lookup/anomalies')
      if (!res.ok) throw new Error('Échec scan')
      setReport(await res.json())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!report) return []
    if (filter === 'all') return report.anomalies
    return report.anomalies.filter((a) => a.severity === filter)
  }, [report, filter])

  const grouped = useMemo(() => {
    const out: Record<string, Anomaly[]> = {}
    for (const a of filtered) {
      const k = a.type
      if (!out[k]) out[k] = []
      out[k].push(a)
    }
    return out
  }, [filtered])

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/chomage/lookup"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Lookup
          </Link>
          <h1 className="text-2xl font-bold">Doublons & anomalies</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Scan automatique des incohérences : codes en multiples versions, libellés
            partagés, langues manquantes, entrées expirées, tables vides.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Re-scanner
        </Button>
      </div>

      {loading && !report ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Scan en cours…
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total entrées" value={report.totalEntries} />
            <KpiCard label="Total tables" value={report.totalTables} />
            <KpiCard label="Erreurs" value={report.summary.error} tone="error" onClick={() => setFilter('error')} />
            <KpiCard label="Avertissements" value={report.summary.warn} tone="warn" onClick={() => setFilter('warn')} />
            <KpiCard label="Infos" value={report.summary.info} tone="info" onClick={() => setFilter('info')} />
          </div>

          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrer :</span>
              {(['all', 'error', 'warn', 'info'] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Tous' : SEVERITY_LABEL[f]?.label}
                </Button>
              ))}
              <span className="ml-auto text-sm text-muted-foreground">
                {filtered.length} anomalie{filtered.length > 1 ? 's' : ''}
              </span>
            </CardContent>
          </Card>

          {Object.entries(grouped).map(([type, anomalies]) => (
            <Card key={type}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {TYPE_LABEL[type] ?? type}
                  <Badge variant="secondary" className="text-[10px]">
                    {anomalies.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead className="text-right w-20">Count</TableHead>
                      <TableHead>Détails</TableHead>
                      <TableHead>Exemples</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anomalies.map((a, i) => {
                      const sev = SEVERITY_LABEL[a.severity]
                      const Icon = sev?.icon ?? Info
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 shrink-0 ${sev?.tone ?? ''}`} />
                              {a.tableLabelFr}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{a.count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {a.details}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.examples?.slice(0, 2).map((e, j) => (
                              <div key={j}>
                                <span className="font-mono">{e.code}</span>
                                {e.labelFr && <span> · {e.labelFr.slice(0, 50)}</span>}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/chomage/lookup/${a.tableId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Voir →
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Aucune anomalie pour ce filtre.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone = 'default',
  onClick,
}: {
  label: string
  value: number
  tone?: 'default' | 'error' | 'warn' | 'info'
  onClick?: () => void
}) {
  const toneClass = {
    default: 'border-border',
    error: 'border-red-300 bg-red-50/40 dark:bg-red-950/10',
    warn: 'border-orange-300 bg-orange-50/40 dark:bg-orange-950/10',
    info: 'border-blue-300 bg-blue-50/40 dark:bg-blue-950/10',
  }[tone]
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition ${toneClass} ${onClick ? 'hover:border-primary cursor-pointer' : ''}`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </Comp>
  )
}
