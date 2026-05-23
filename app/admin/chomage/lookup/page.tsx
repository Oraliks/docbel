'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Search, ExternalLink, Database, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface LookupTable {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  group: string | null
  sourcePath: string | null
  entriesCount: number
  lastImportedAt: string | null
}

interface LookupCategory {
  id: string
  slug: string
  labelFr: string
  labelNl: string
  order: number
  tables: LookupTable[]
}

export default function LookupAdminPage() {
  const [categories, setCategories] = useState<LookupCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/lookup/tables')
      const data = await res.json()
      setCategories(data.categories ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const totals = useMemo(() => {
    let tables = 0
    let entries = 0
    let imported = 0
    for (const cat of categories) {
      for (const t of cat.tables) {
        tables++
        entries += t.entriesCount
        if (t.lastImportedAt) imported++
      }
    }
    return { categories: categories.length, tables, entries, imported }
  }, [categories])

  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase().trim()
    return categories
      .map((cat) => ({
        ...cat,
        tables: cat.tables.filter(
          (t) =>
            t.labelFr.toLowerCase().includes(q) ||
            t.labelNl.toLowerCase().includes(q) ||
            t.prefix.toLowerCase().includes(q) ||
            (t.group ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.tables.length > 0)
  }, [categories, search])

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Lookup ONEM</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Référentiel local des codes ONEM. Base de données métier réutilisable par les
            calculateurs, les barèmes, la génération de documents, etc. Pour alimenter chaque
            table, exporte le CSV depuis{' '}
            <a
              href="https://services.onem.be/lookupweb/"
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-0.5"
            >
              services.onem.be/lookupweb <ExternalLink className="w-3 h-3" />
            </a>{' '}
            puis upload-le sur la page de détail de la table.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Link href="/admin/chomage/lookup/import-batch">
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Import en lot
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Catégories" value={totals.categories} />
        <KpiCard label="Tables" value={totals.tables} />
        <KpiCard label="Tables alimentées" value={totals.imported} tone="primary" />
        <KpiCard label="Entrées totales" value={totals.entries} tone="success" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une table (libellé, préfixe, groupe…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-6">
          {filtered.map((cat) => {
            const groupedTables = groupBy(cat.tables, (t) => t.group ?? '—')
            return (
              <Card key={cat.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    {cat.labelFr}
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      {cat.tables.length} table{cat.tables.length > 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(groupedTables).map(([group, tables]) => (
                    <div key={group}>
                      {group !== '—' && (
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          {group}
                        </h3>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {tables.map((table) => (
                          <TableCard key={table.id} table={table} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {cat.tables.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      Cette catégorie n&apos;a pas encore de table définie. À compléter via le seed.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'primary'
}) {
  const toneClass = {
    default: 'border-border',
    success: 'border-green-300 bg-green-50/40 dark:bg-green-950/10',
    primary: 'border-primary/30 bg-primary/5',
  }[tone]
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString('fr-BE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

function TableCard({ table }: { table: LookupTable }) {
  const hasData = table.entriesCount > 0
  return (
    <Link
      href={`/admin/chomage/lookup/${table.id}`}
      className={`block p-3 rounded-md border text-sm transition hover:border-primary ${
        hasData ? 'bg-background' : 'bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-mono">
          {table.prefix}
        </Badge>
        <span className="font-medium truncate flex-1" title={table.labelFr}>
          {table.labelFr.replace(`${table.prefix} - `, '').replace(`${table.prefix} `, '')}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        {hasData ? (
          <>
            <span>{table.entriesCount.toLocaleString('fr-BE')} entrées</span>
            {table.lastImportedAt && (
              <span>
                · MAJ {new Date(table.lastImportedAt).toLocaleDateString('fr-BE')}
              </span>
            )}
          </>
        ) : (
          <span className="italic">Vide — import requis</span>
        )}
      </div>
    </Link>
  )
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) {
    const k = keyFn(item)
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out
}
