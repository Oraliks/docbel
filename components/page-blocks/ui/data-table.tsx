'use client'

import { useMemo, useState } from 'react'
import { z } from 'zod'
import { ArrowUpDown, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Field,
  Group,
  NumberControl,
} from '@/components/page-builder/inspector/controls'
import { defineBlock } from '@/lib/page-builder/block-definition'
import { cn } from '@/lib/utils'
import { dataTableSchema as schema } from './schemas'

type Props = z.infer<typeof schema>

function parseCols(s?: string): string[] {
  return (s || '').split('|').map((c) => c.trim()).filter(Boolean)
}
function parseRows(s?: string): string[][] {
  return (s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split('|').map((c) => c.trim()))
}
function compareCells(a: string, b: string): number {
  const na = parseFloat(a.replace(',', '.'))
  const nb = parseFloat(b.replace(',', '.'))
  if (!Number.isNaN(na) && !Number.isNaN(nb) && /^[\d.,\s€%]+$/.test(a) && /^[\d.,\s€%]+$/.test(b)) {
    return na - nb
  }
  return a.localeCompare(b, 'fr')
}

function DataTableView({
  columns,
  rows,
  searchable,
  sortable,
  pageSize = 0,
  striped,
  compact,
}: Props) {
  const cols = useMemo(() => parseCols(columns), [columns])
  const allRows = useMemo(() => parseRows(rows), [rows])
  const [query, setQuery] = useState('')
  const [sortIdx, setSortIdx] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let r = allRows
    if (searchable && query.trim()) {
      const q = query.toLowerCase()
      r = r.filter((row) => row.some((c) => c.toLowerCase().includes(q)))
    }
    if (sortable && sortIdx != null) {
      r = [...r].sort((x, y) => {
        const d = compareCells(x[sortIdx] ?? '', y[sortIdx] ?? '')
        return sortDir === 'asc' ? d : -d
      })
    }
    return r
  }, [allRows, searchable, query, sortable, sortIdx, sortDir])

  const pages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1
  const clampedPage = Math.min(page, pages - 1)
  const visible =
    pageSize > 0
      ? filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)
      : filtered

  const toggleSort = (i: number) => {
    if (!sortable) return
    if (sortIdx === i) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortIdx(i)
      setSortDir('asc')
    }
    setPage(0)
  }

  if (cols.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Configurez les colonnes du tableau (onglet Contenu).
      </div>
    )
  }

  return (
    <div className="my-2 w-full space-y-3">
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Rechercher…"
            className="h-9 pl-8"
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c, i) => (
                <TableHead
                  key={i}
                  className={cn(sortable && 'cursor-pointer select-none')}
                  onClick={() => toggleSort(i)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c}
                    {sortable && (
                      <ArrowUpDown
                        className={cn(
                          'size-3',
                          sortIdx === i ? 'text-foreground' : 'text-muted-foreground/40'
                        )}
                      />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length} className="py-6 text-center text-muted-foreground">
                  Aucun résultat
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row, ri) => (
                <TableRow key={ri} className={cn(striped && ri % 2 === 1 && 'bg-muted/30')}>
                  {cols.map((_, ci) => (
                    <TableCell key={ci} className={cn(compact && 'py-1.5')}>
                      {row[ci] ?? ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pageSize > 0 && pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filtered.length} ligne(s) · page {clampedPage + 1}/{pages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={clampedPage === 0}
              onClick={() => setPage(clampedPage - 1)}
              className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={clampedPage >= pages - 1}
              onClick={() => setPage(clampedPage + 1)}
              className="rounded-md border px-2 py-1 text-xs disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const dataTable = defineBlock({
  type: 'dataTable',
  schema,
  defaults: {
    columns: 'Nom | Prix | Stock',
    rows: 'Pomme | 1,20 | 30\nPoire | 0,90 | 12\nCerise | 3,50 | 8',
    searchable: true,
    sortable: true,
    pageSize: 0,
    striped: true,
    compact: false,
  },
  meta: {
    name: 'Tableau de données',
    description: 'Table triable, filtrable et paginée',
    category: 'ui',
    icon: 'table',
    shortcuts: ['table', 'tableau', 'datatable', 'grid'],
  },
  Render: ({ props }) => <DataTableView {...props} />,
  Fields: ({ props, onChange }) => (
    <>
      <Group title="Données" defaultOpen>
        <Field label="Colonnes" hint="Séparées par une barre verticale |">
          <Textarea
            value={props.columns ?? ''}
            onChange={(e) => onChange({ columns: e.target.value })}
            rows={1}
            placeholder="Nom | Prix | Stock"
            className="resize-y font-mono text-xs"
          />
        </Field>
        <Field label="Lignes" hint="Une ligne par enregistrement, cellules séparées par |">
          <Textarea
            value={props.rows ?? ''}
            onChange={(e) => onChange({ rows: e.target.value })}
            rows={6}
            placeholder={'Pomme | 1,20 | 30\nPoire | 0,90 | 12'}
            className="resize-y font-mono text-xs"
          />
        </Field>
      </Group>
      <Group title="Options">
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Recherche" className="flex-1">
            <span className="sr-only">Recherche</span>
          </Field>
          <Switch
            checked={props.searchable ?? false}
            onCheckedChange={(v) => onChange({ searchable: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Tri par colonne" className="flex-1">
            <span className="sr-only">Tri</span>
          </Field>
          <Switch
            checked={props.sortable ?? false}
            onCheckedChange={(v) => onChange({ sortable: v })}
          />
        </div>
        <Field label="Lignes par page (0 = tout)">
          <NumberControl
            value={props.pageSize}
            onChange={(v) => onChange({ pageSize: v })}
            min={0}
            max={200}
            suffix="/page"
            placeholder="0"
          />
        </Field>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Lignes alternées" className="flex-1">
            <span className="sr-only">Lignes alternées</span>
          </Field>
          <Switch
            checked={props.striped ?? false}
            onCheckedChange={(v) => onChange({ striped: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-1">
          <Field label="Compact" className="flex-1">
            <span className="sr-only">Compact</span>
          </Field>
          <Switch
            checked={props.compact ?? false}
            onCheckedChange={(v) => onChange({ compact: v })}
          />
        </div>
      </Group>
    </>
  ),
})
