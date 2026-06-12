'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Download, Home, Info, Search, X } from 'lucide-react'
import { csvSafeCell, UTF8_BOM } from '@/lib/baremes/csv'
import type { AllocationMatrixData, MatrixGroup } from '@/lib/baremes/allocationMatrix'

// Accent par situation (repris du mockup : A/N en bleu, cohabitants en rose).
const ACCENT: Record<MatrixGroup['accent'], { text: string; head: string; ring: string }> = {
  a: { text: 'text-blue-700 dark:text-blue-300', head: 'bg-blue-50/70 dark:bg-blue-950/30', ring: 'border-blue-200 dark:border-blue-900' },
  n: { text: 'text-sky-700 dark:text-sky-300', head: 'bg-sky-50/70 dark:bg-sky-950/30', ring: 'border-sky-200 dark:border-sky-900' },
  b: { text: 'text-rose-700 dark:text-rose-300', head: 'bg-rose-50/70 dark:bg-rose-950/30', ring: 'border-rose-200 dark:border-rose-900' },
  b2: { text: 'text-rose-700 dark:text-rose-300', head: 'bg-rose-100/70 dark:bg-rose-950/40', ring: 'border-rose-300 dark:border-rose-900' },
}

function formatAmount(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

export function BaremeMatrix({ data }: { data: AllocationMatrixData }) {
  const [categorie, setCategorie] = useState<'all' | 'A' | 'N' | 'B'>('all')
  const [search, setSearch] = useState('')
  const [maxTranche, setMaxTranche] = useState<string>('')

  // Groupes visibles selon la catégorie (B inclut le groupe 2ᵉ période B2).
  const visibleGroups = useMemo(() => {
    return data.groups.filter((g) => {
      if (categorie === 'all') return true
      if (categorie === 'B') return g.accent === 'b' || g.accent === 'b2'
      return g.key === categorie
    })
  }, [data.groups, categorie])

  // Colonnes visibles (filtre recherche par code/label) + index dans l'ordre plat.
  const flatIndexByKey = useMemo(() => {
    const m = new Map<string, number>()
    data.columnKeys.forEach((k, i) => m.set(k, i))
    return m
  }, [data.columnKeys])

  const q = search.trim().toLowerCase()
  const shownGroups = useMemo(() => {
    return visibleGroups
      .map((g) => ({
        ...g,
        columns: g.columns.filter(
          (c) =>
            !q ||
            c.label.toLowerCase().includes(q) ||
            c.codes.some((code) => code.toLowerCase().includes(q))
        ),
      }))
      .filter((g) => g.columns.length > 0)
  }, [visibleGroups, q])

  const shownColumnIdx = useMemo(
    () => shownGroups.flatMap((g) => g.columns.map((c) => flatIndexByKey.get(c.key)!)),
    [shownGroups, flatIndexByKey]
  )

  // Lignes filtrées par plage de tranche.
  const maxN = maxTranche === '' ? null : Number(maxTranche)
  const rows = useMemo(() => {
    if (maxN == null || Number.isNaN(maxN)) return data.rows
    return data.rows.filter((r) => r.isMin || (/^\d+$/.test(r.tranche) && Number(r.tranche) <= maxN))
  }, [data.rows, maxN])

  const colCount = shownColumnIdx.length

  const exportCsv = () => {
    const header = ['Tranche', ...shownGroups.flatMap((g) => g.columns.map((c) => c.label))]
    const lines = [header.map(csvSafeCell).join(',')]
    for (const r of rows) {
      const cells = [r.tranche, ...shownColumnIdx.map((i) => r.values[i])]
      lines.push(cells.map(csvSafeCell).join(','))
    }
    const csv = UTF8_BOM + lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `baremes-allocations-${data.validFrom ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="px-6 pt-6 pb-4 lg:px-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<Link href="/outils" />}
                className="inline-flex items-center gap-1"
              >
                <Home className="size-3.5" />
                Outils
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/outils/bareme-chomage" />}>
                Barèmes chômage
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{data.eyebrow}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              {data.eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {data.title}{' '}
              <span className="italic text-teal-600 dark:text-teal-400">{data.titleAccent}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.subtitleNl}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white">
              <Calendar className="size-4" />
              Valable · {formatDate(data.validFrom)}
            </span>
            {data.multiplicateur != null && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Multiplicateur</div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {data.multiplicateur.toLocaleString('fr-BE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="mx-6 mb-4 rounded-xl border border-border bg-muted/30 p-3 lg:mx-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tranches
            </span>
            {maxTranche !== '' ? (
              <button
                type="button"
                onClick={() => setMaxTranche('')}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
              >
                MIN – {maxTranche}
                <X className="size-3" />
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Toutes</span>
            )}
            <input
              type="number"
              min={1}
              max={99}
              value={maxTranche}
              onChange={(e) => setMaxTranche(e.target.value)}
              placeholder="jusqu'à…"
              className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs"
              aria-label="Afficher les tranches jusqu'à"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Catégorie
            </span>
            <Select value={categorie} onValueChange={(v) => setCategorie(v as typeof categorie)}>
              <SelectTrigger className="h-8 w-[190px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="A">Charge de famille</SelectItem>
                <SelectItem value="N">Isolés</SelectItem>
                <SelectItem value="B">Cohabitants</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un code…"
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Download className="size-3.5" />
            Exporter
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mx-6 mb-4 overflow-auto rounded-xl border border-border lg:mx-8" style={{ maxHeight: '64vh' }}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            {/* Ligne groupes */}
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-20 border-b border-r border-border bg-muted px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              >
                CODE
              </th>
              {shownGroups.map((g) => (
                <th
                  key={g.key}
                  colSpan={g.columns.length}
                  className={`border-b border-l border-border px-3 py-2 text-center ${ACCENT[g.accent].head}`}
                >
                  <div className={`text-sm font-semibold ${ACCENT[g.accent].text}`}>{g.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{g.sublabel}</div>
                </th>
              ))}
            </tr>
            {/* Ligne codes + taux */}
            <tr>
              {shownGroups.flatMap((g) =>
                g.columns.map((c) => (
                  <th
                    key={c.key}
                    className={`min-w-[64px] border-b border-l border-border px-3 py-1.5 text-center ${ACCENT[g.accent].head}`}
                  >
                    <div className={`text-sm font-bold ${ACCENT[g.accent].text}`}>{c.label}</div>
                    <div className="text-[10px] font-medium text-muted-foreground">{c.rate ?? c.sub ?? '—'}</div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.tranche}
                className={r.isMin ? 'bg-blue-50/60 dark:bg-blue-950/20 font-semibold' : 'hover:bg-muted/40'}
              >
                <td
                  className={`sticky left-0 z-10 border-b border-r border-border px-3 py-1.5 text-left font-mono text-xs ${
                    r.isMin ? 'bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300' : 'bg-card text-muted-foreground'
                  }`}
                >
                  {r.tranche}
                </td>
                {shownColumnIdx.map((i) => (
                  <td
                    key={i}
                    className={`border-b border-l border-border px-3 py-1.5 text-right tabular-nums ${
                      r.isMin ? 'text-blue-700 dark:text-blue-300' : 'text-foreground'
                    }`}
                  >
                    {formatAmount(r.values[i])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount + 1} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucune tranche ne correspond au filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pied */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-6 py-3 text-xs text-muted-foreground lg:px-8">
        <span className="inline-flex items-center gap-1.5">
          <Info className="size-3.5" />
          {data.unitLabel}
        </span>
        <span>Dernière mise à jour : {formatDate(data.validFrom)}</span>
      </div>
    </div>
  )
}
