'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Stats {
  generatedAt: string
  counts: {
    categories: number
    tables: number
    entries: number
    fedTables: number
    emptyTables: number
  }
  languageCoverage: {
    fr: { count: number; percent: number }
    nl: { count: number; percent: number }
    de: { count: number; percent: number }
    en: { count: number; percent: number }
  }
  coverageByCategory: {
    slug: string
    labelFr: string
    totalTables: number
    fedTables: number
    totalEntries: number
  }[]
  recentImports: {
    id: string
    labelFr: string
    lastImportedAt: string
    lastImportedBy: string | null
    entriesCount: number
    category: { labelFr: string }
  }[]
  topTables: {
    id: string
    labelFr: string
    entriesCount: number
    category: { labelFr: string }
  }[]
}

export default function LookupStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lookup/stats')
      if (!res.ok) throw new Error('Échec chargement stats')
      setStats(await res.json())
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

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }
  if (!stats) return null

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
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d&apos;ensemble du référentiel : volumes, couverture multilingue, activité.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI principaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Catégories" value={stats.counts.categories} />
        <Kpi label="Tables totales" value={stats.counts.tables} />
        <Kpi label="Tables alimentées" value={stats.counts.fedTables} tone="success" />
        <Kpi label="Tables vides" value={stats.counts.emptyTables} tone="muted" />
        <Kpi label="Entrées totales" value={stats.counts.entries} tone="primary" />
      </div>

      {/* Couverture multilingue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Couverture multilingue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(['fr', 'nl', 'de', 'en'] as const).map((lang) => {
              const cov = stats.languageCoverage[lang]
              return (
                <div key={lang}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium uppercase">{lang}</span>
                    <span className="text-muted-foreground">
                      {cov.count.toLocaleString('fr-BE')} / {stats.counts.entries.toLocaleString('fr-BE')} ({cov.percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${lang === 'fr' || lang === 'nl' ? 'bg-green-500' : lang === 'de' ? 'bg-blue-500' : 'bg-orange-400'}`}
                      style={{ width: `${cov.percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Couverture par catégorie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Couverture par catégorie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-right">Tables alimentées</TableHead>
                <TableHead className="text-right">Entrées</TableHead>
                <TableHead>Progression</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.coverageByCategory.map((cat) => {
                const pct =
                  cat.totalTables > 0 ? (cat.fedTables / cat.totalTables) * 100 : 0
                return (
                  <TableRow key={cat.slug}>
                    <TableCell className="font-medium">{cat.labelFr}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cat.fedTables} / {cat.totalTables}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cat.totalEntries.toLocaleString('fr-BE')}
                    </TableCell>
                    <TableCell className="w-48">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Imports récents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Entrées</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentImports.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/admin/chomage/lookup/${t.id}`} className="hover:underline">
                        {t.labelFr}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.category.labelFr}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.entriesCount.toLocaleString('fr-BE')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.lastImportedAt).toLocaleDateString('fr-BE')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top 10 tables par taille</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Entrées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topTables.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/admin/chomage/lookup/${t.id}`} className="hover:underline">
                        {t.labelFr}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.category.labelFr}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.entriesCount.toLocaleString('fr-BE')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'muted' | 'primary'
}) {
  const toneClass = {
    default: 'border-border',
    success: 'border-green-300 bg-green-50/40 dark:bg-green-950/10',
    muted: 'border-border bg-muted/30',
    primary: 'border-primary/30 bg-primary/5',
  }[tone]
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}
