'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import { getModuleInfo } from '@/lib/lookup/modules'
import { cleanTableLabel } from '@/lib/lookup/cleanTableLabel'
import { FlagPrefix } from './flag-prefix'

// ─── Types (forme renvoyée par GET /api/lookup/tables/[id]) ──────────────────

export interface TableViewTable {
  id: string
  slug: string
  prefix: string
  labelFr: string
  labelNl: string
  group: string | null
  sourcePath: string | null
  entriesCount: number
  updatedLabel: string | null
  category: { slug: string; labelFr: string }
}

interface EntryRow {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: string | null
  validUntil: string | null
  metadata: Record<string, string> | null
}

type EndDateFilter = 'all' | 'none' | 'filled'

interface Filters {
  code: string
  desc: string
  validOn: string // YYYY-MM-DD ou ''
  endDate: EndDateFilter
  modifiedSince: string // YYYY-MM-DD ou ''
  includeAll: boolean
}

const EMPTY_FILTERS: Filters = {
  code: '',
  desc: '',
  validOn: '',
  endDate: 'all',
  modifiedSince: '',
  includeAll: false,
}

const PAGE_SIZES = [10, 25, 50, 100]

interface Props {
  table: TableViewTable
}

/**
 * Vue détaillée d'une table de lookup ONEM — refonte façon
 * services.onem.be/lookupweb, adaptée au thème DocBel.
 *
 * Panneau de filtres + recherches prédéfinies + tableau d'entrées dépliables
 * + pagination + export CSV. Tout passe par `/api/lookup/tables/[id]`.
 */
export function LookupTableView({ table }: Props) {
  const moduleInfo = getModuleInfo(table.prefix)
  const displayLabel = cleanTableLabel(table.labelFr, table.prefix)

  // Filtres en cours d'édition (formulaire) vs filtres appliqués (requête).
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [rows, setRows] = useState<EntryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const buildQuery = useCallback(
    (f: Filters, limit: number, offset: number) => {
      const usp = new URLSearchParams()
      if (f.code) usp.set('code', f.code)
      if (f.desc) usp.set('desc', f.desc)
      if (f.validOn) usp.set('validOn', f.validOn)
      if (f.endDate !== 'all') usp.set('endDate', f.endDate)
      if (f.modifiedSince) usp.set('modifiedSince', f.modifiedSince)
      if (f.includeAll) usp.set('includeAll', 'true')
      usp.set('limit', String(limit))
      usp.set('offset', String(offset))
      return usp.toString()
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const qs = buildQuery(applied, pageSize, (page - 1) * pageSize)
    fetch(`/api/lookup/tables/${table.id}?${qs}`)
      .then((r) => r.json())
      .then((data: { entries?: EntryRow[]; pagination?: { total: number } }) => {
        if (cancelled) return
        setRows(data.entries ?? [])
        setTotal(data.pagination?.total ?? 0)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [table.id, applied, page, pageSize, buildQuery])

  const apply = (f: Filters) => {
    setApplied(f)
    setPage(1)
    setExpanded(new Set())
  }
  const runDraft = () => apply(draft)
  const reset = () => {
    setDraft(EMPTY_FILTERS)
    apply(EMPTY_FILTERS)
  }

  // Recherches prédéfinies (colonne de droite).
  const predefined = [
    {
      key: 'valid-today',
      label: 'Valeur valide aujourd’hui',
      icon: CalendarClock,
      run: () => {
        const f = { ...EMPTY_FILTERS, validOn: today() }
        setDraft(f)
        apply(f)
      },
    },
    {
      key: 'no-end',
      label: 'Valeur sans date de fin',
      icon: ListChecks,
      run: () => {
        const f = { ...EMPTY_FILTERS, endDate: 'none' as const, includeAll: true }
        setDraft(f)
        apply(f)
      },
    },
    {
      key: 'all',
      label: 'Toutes les valeurs',
      icon: Database,
      run: () => {
        const f = { ...EMPTY_FILTERS, includeAll: true }
        setDraft(f)
        apply(f)
      },
    },
    {
      key: 'mod-30',
      label: 'Modifications · 30 derniers jours',
      icon: CalendarClock,
      run: () => {
        const f = { ...EMPTY_FILTERS, modifiedSince: daysAgo(30), includeAll: true }
        setDraft(f)
        apply(f)
      },
    },
    {
      key: 'mod-60',
      label: 'Modifications · 60 derniers jours',
      icon: CalendarClock,
      run: () => {
        const f = { ...EMPTY_FILTERS, modifiedSince: daysAgo(60), includeAll: true }
        setDraft(f)
        apply(f)
      },
    },
    {
      key: 'mod-90',
      label: 'Modifications · 90 derniers jours',
      icon: CalendarClock,
      run: () => {
        const f = { ...EMPTY_FILTERS, modifiedSince: daysAgo(90), includeAll: true }
        setDraft(f)
        apply(f)
      },
    },
  ]

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      {/* ── Bandeau d'en-tête (dégradé glass) ── */}
      <header className="glass-surface relative overflow-hidden px-6 py-7">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shrink-0">
            <Database className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {table.prefix}
              </Badge>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {moduleInfo.label}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight truncate">{displayLabel}</h1>
            <p className="text-sm text-muted-foreground">
              {table.entriesCount.toLocaleString('fr-BE')} entrées · catégorie {table.category.labelFr}
            </p>
            {table.updatedLabel && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                Mise à jour le {table.updatedLabel}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Filtres + recherches prédéfinies ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Colonne filtres (2/3) */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Filter className="size-4 text-primary" />
              Filtres de recherche
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                runDraft()
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Code">
                  <Input
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    placeholder="Ex. 27, 2A, 27SP…"
                  />
                </Field>
                <Field label="Description">
                  <Input
                    value={draft.desc}
                    onChange={(e) => setDraft({ ...draft, desc: e.target.value })}
                    placeholder="Mot-clé ou expression"
                  />
                </Field>
                <Field label="Valide à la date">
                  <Input
                    type="date"
                    value={draft.validOn}
                    onChange={(e) =>
                      setDraft({ ...draft, validOn: e.target.value, includeAll: false })
                    }
                  />
                </Field>
                <Field
                  label="Modifié depuis"
                  hint="date d’édition dans Beldoc (≠ date ONEM)"
                >
                  <Input
                    type="date"
                    value={draft.modifiedSince}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        modifiedSince: e.target.value,
                        includeAll: e.target.value ? true : draft.includeAll,
                      })
                    }
                  />
                </Field>
              </div>

              {/* Date de fin — radio segmenté (Non remplie / Remplie / Les deux) */}
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Date de fin</legend>
                <div className="flex flex-wrap gap-1.5">
                  <RadioPill
                    active={draft.endDate === 'none'}
                    onClick={() => setDraft({ ...draft, endDate: 'none' })}
                  >
                    Non remplie
                  </RadioPill>
                  <RadioPill
                    active={draft.endDate === 'filled'}
                    onClick={() => setDraft({ ...draft, endDate: 'filled' })}
                  >
                    Remplie
                  </RadioPill>
                  <RadioPill
                    active={draft.endDate === 'all'}
                    onClick={() => setDraft({ ...draft, endDate: 'all' })}
                  >
                    Les deux
                  </RadioPill>
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button type="submit">
                  <Search className="size-4" />
                  Rechercher
                </Button>
                <Button type="button" variant="ghost" onClick={reset}>
                  <RotateCcw className="size-4" />
                  Réinitialiser
                </Button>
                <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={draft.includeAll}
                    onChange={(e) => setDraft({ ...draft, includeAll: e.target.checked })}
                    className="size-3.5 accent-[var(--primary)]"
                  />
                  Inclure l’historique (entrées expirées)
                </label>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Colonne recherches prédéfinies (1/3) */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="size-4 text-primary" />
              Recherches prédéfinies
            </div>
            <ul className="space-y-1.5">
              {predefined.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={p.run}
                    className="group flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-muted"
                  >
                    <p.icon className="size-4 text-muted-foreground group-hover:text-primary" />
                    <span className="flex-1">{p.label}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground/50" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Résultats ── */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
            <span className="text-sm font-semibold">
              Résultats{' '}
              <span className="text-muted-foreground tabular-nums">
                ({total.toLocaleString('fr-BE')})
              </span>
            </span>
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>

          {rows.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Search className="size-9 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucune entrée ne correspond à ces critères.
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="size-3.5" />
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-9" aria-label="Détails" />
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead className="w-24">Date de début</TableHead>
                    <TableHead className="w-24">Date de fin</TableHead>
                    <TableHead className="w-[34%]">Description française</TableHead>
                    <TableHead className="w-[34%]">Description néerlandaise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <EntryTableRow
                      key={r.id}
                      row={r}
                      open={expanded.has(r.id)}
                      onToggle={() => toggleRow(r.id)}
                      tableSlug={table.slug}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination + taille de page */}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Afficher</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => {
                    if (!v) return
                    setPageSize(Number(v))
                    setPage(1)
                  }}
                >
                  <SelectTrigger size="sm" className="w-[72px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>par page</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Précédent
                </Button>
                <span className="px-2 text-xs text-muted-foreground tabular-nums">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Suivant
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Actions bas de page ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Source : ONEM</span>
        <Button variant="ghost" nativeButton={false} render={<Link href="/outils/lookup-onem" />}>
          <ArrowLeft className="size-4" />
          Retour aux catégories
        </Button>
      </div>
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-text-faint">· {hint}</span>}
      </Label>
      {children}
    </div>
  )
}

function RadioPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-background text-muted-foreground hover:bg-muted')
      }
    >
      {active && <Check className="size-3" />}
      {children}
    </button>
  )
}

function EntryTableRow({
  row,
  open,
  onToggle,
  tableSlug,
}: {
  row: EntryRow
  open: boolean
  onToggle: () => void
  tableSlug: string
}) {
  const metaEntries = row.metadata ? Object.entries(row.metadata) : []
  const detailCount =
    metaEntries.length + (row.labelDe ? 1 : 0) + (row.labelEn ? 1 : 0)
  const hasDetails = detailCount > 0
  const isExpired = row.validUntil && new Date(row.validUntil) < new Date()

  return (
    <Fragment>
      <TableRow
        onClick={() => hasDetails && onToggle()}
        className={hasDetails ? 'cursor-pointer' : ''}
        aria-expanded={hasDetails ? open : undefined}
      >
        <TableCell className="align-top">
          {hasDetails ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              className="inline-flex size-6 items-center justify-center rounded border border-input bg-background transition-colors hover:bg-muted"
              aria-label={open ? 'Réduire' : `${detailCount} info(s) supplémentaire(s)`}
              title={open ? 'Réduire' : `${detailCount} info(s) supplémentaire(s)`}
            >
              {open ? <Minus className="size-3" /> : <Plus className="size-3" />}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs align-top">{row.code}</TableCell>
        <TableCell className="text-xs text-muted-foreground align-top tabular-nums">
          {row.validFrom ? new Date(row.validFrom).toLocaleDateString('fr-BE') : '—'}
        </TableCell>
        <TableCell className="text-xs align-top tabular-nums">
          {row.validUntil ? (
            <span className="text-orange-700">
              {new Date(row.validUntil).toLocaleDateString('fr-BE')}
            </span>
          ) : (
            <span className="text-green-700">—</span>
          )}
        </TableCell>
        <TableCell className="text-sm align-top whitespace-normal break-words leading-snug">
          <FlagPrefix tableSlug={tableSlug} label={row.labelFr} />
          {row.labelFr || <span className="text-muted-foreground/40">—</span>}
          {isExpired && (
            <Badge
              variant="outline"
              className="ml-2 border-orange-300 text-[10px] text-orange-800"
            >
              historique
            </Badge>
          )}
        </TableCell>
        <TableCell className="text-sm align-top whitespace-normal break-words leading-snug text-muted-foreground">
          {row.labelNl || '—'}
        </TableCell>
      </TableRow>

      {open && hasDetails && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={5} className="py-3">
            <div className="space-y-3 text-xs">
              {(row.labelDe || row.labelEn) && (
                <DetailGrid
                  title="Traductions"
                  entries={[
                    ...(row.labelDe ? [{ label: 'Allemand', value: row.labelDe }] : []),
                    ...(row.labelEn ? [{ label: 'Anglais', value: row.labelEn }] : []),
                  ]}
                />
              )}
              {metaEntries.length > 0 && (
                <DetailGrid
                  title="Informations supplémentaires"
                  entries={metaEntries.map(([label, value]) => ({ label, value }))}
                />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

function DetailGrid({
  title,
  entries,
}: {
  title: string
  entries: { label: string; value: string }[]
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <div key={e.label} className="flex flex-col">
            <dt className="text-[10px] text-muted-foreground">{e.label}</dt>
            <dd className="break-words text-foreground">{e.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── Helpers dates (YYYY-MM-DD pour <input type=date> + params API) ──────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}
