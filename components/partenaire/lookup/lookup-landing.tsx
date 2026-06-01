'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarCheck,
  ChevronRight,
  Database,
  ExternalLink,
  Globe,
  Layers,
  Search,
  Shapes,
  ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getModuleInfo } from '@/lib/lookup/modules'
import { cleanTableLabel } from '@/lib/lookup/cleanTableLabel'

export interface LandingTable {
  id: string
  slug: string
  prefix: string
  labelFr: string
  group: string | null
  entriesCount: number
}

export interface LandingCategory {
  slug: string
  labelFr: string
  tables: LandingTable[]
}

interface Props {
  categories: LandingCategory[]
  initialCat?: string
}

/**
 * Skin par catégorie (icône + tinte), façon services.onem.be/lookupweb.
 * Classes Tailwind écrites en toutes lettres → la JIT les détecte (pas
 * d'interpolation dynamique de nom de classe).
 */
const CATEGORY_SKIN: Record<string, { icon: LucideIcon; tile: string }> = {
  global: { icon: Globe, tile: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  signaletic: { icon: Shapes, tile: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  verification: { icon: ShieldCheck, tile: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  dispo: { icon: CalendarCheck, tile: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  bcss: { icon: Building2, tile: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  autre: { icon: Briefcase, tile: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300' },
}
const FALLBACK_SKIN = { icon: Database, tile: 'bg-primary/10 text-primary' }

function skinFor(slug: string) {
  return CATEGORY_SKIN[slug] ?? FALLBACK_SKIN
}

/**
 * Landing du Lookup ONEM — refonte façon services.onem.be/lookupweb adaptée au
 * thème DocBel.
 *
 * Drill-down par catégorie : 6 cartes catégorie → clic → grille des tables de
 * cette catégorie. Un champ de recherche transcende le drill-down (filtre à
 * plat toutes les tables, toutes catégories). Clic table → /[tableSlug].
 */
export function LookupLanding({ categories, initialCat }: Props) {
  const [q, setQ] = useState('')
  // `initialCat` permet le deep-link entrant (?cat=signaletic) sans re-synchroniser
  // l'URL en sortie : la page est force-dynamic, un router.replace() à chaque
  // changement remonterait l'arbre client et réinitialiserait cet état.
  const [activeCat, setActiveCat] = useState<string>(
    initialCat && categories.some((c) => c.slug === initialCat) ? initialCat : ''
  )

  // Tables alimentées uniquement (les shells du seed manuel ne servent à rien).
  const fedCategories = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, tables: c.tables.filter((t) => t.entriesCount > 0) }))
        .filter((c) => c.tables.length > 0),
    [categories]
  )

  const allTables = useMemo(
    () =>
      fedCategories.flatMap((c) =>
        c.tables.map((t) => ({ ...t, categoryLabel: c.labelFr, categorySlug: c.slug }))
      ),
    [fedCategories]
  )

  const totalEntries = allTables.reduce((sum, t) => sum + t.entriesCount, 0)

  const searching = q.trim().length > 0
  const searchHits = useMemo(() => {
    if (!searching) return []
    const needle = q.trim().toLowerCase()
    return allTables.filter((t) =>
      `${t.prefix} ${t.labelFr} ${t.group ?? ''} ${t.categoryLabel}`
        .toLowerCase()
        .includes(needle)
    )
  }, [allTables, q, searching])

  const activeCategory = fedCategories.find((c) => c.slug === activeCat) ?? null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Bandeau d'accueil (dégradé glass) ── */}
      <header className="glass-surface relative overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            Base de connaissances ONEM
          </p>
          <h1 className="glass-display text-[30px] font-semibold leading-[1.1] sm:text-[38px]">
            Lookup <em>ONEM</em>
          </h1>
          <p className="text-sm text-[color:var(--glass-ink-soft)]">
            Consultez les référentiels et signalétiques officiels de l’ONEM.
            Choisissez une catégorie pour explorer ses tables, ou{' '}
            <Link href="/outils/lookup-onem/recherche" className="underline">
              lancez une recherche transverse
            </Link>{' '}
            sur toutes les nomenclatures.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[color:var(--glass-ink-faint)]">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5" />
              {fedCategories.length} catégories · {allTables.length} tables
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="size-3.5" />
              {totalEntries.toLocaleString('fr-BE')} codes
            </span>
          </div>
        </div>
      </header>

      {/* ── Recherche libre de table (transcende le drill-down) ── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer les tables (ex. nationalité, S04, bureau…)"
          className="pl-9"
        />
      </div>

      {searching ? (
        /* ── Mode recherche : résultats à plat, toutes catégories ── */
        <Section
          title={`${searchHits.length} table${searchHits.length > 1 ? 's' : ''} pour « ${q.trim()} »`}
        >
          {searchHits.length === 0 ? (
            <EmptyHint>Aucune table ne correspond à votre recherche.</EmptyHint>
          ) : (
            <TableGrid tables={searchHits} showCategory />
          )}
        </Section>
      ) : activeCategory ? (
        /* ── Mode catégorie sélectionnée : ses tables ── */
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <CategoryTile slug={activeCategory.slug} size="sm" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight">{activeCategory.labelFr}</h2>
                <p className="text-xs text-muted-foreground">
                  {activeCategory.tables.length} tables ·{' '}
                  {activeCategory.tables
                    .reduce((n, t) => n + t.entriesCount, 0)
                    .toLocaleString('fr-BE')}{' '}
                  codes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveCat('')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" />
              Toutes les catégories
            </button>
          </div>
          <TableGrid tables={activeCategory.tables} />
        </div>
      ) : (
        /* ── Mode défaut : 6 cartes catégorie ── */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fedCategories.map((c) => {
            const skin = skinFor(c.slug)
            const Icon = skin.icon
            const codes = c.tables.reduce((n, t) => n + t.entriesCount, 0)
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => setActiveCat(c.slug)}
                className="group text-left"
              >
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`flex size-11 items-center justify-center rounded-xl ${skin.tile}`}>
                        <Icon className="size-5" />
                      </span>
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        {c.tables.length} tables
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold leading-snug group-hover:text-primary">
                        {c.labelFr}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {codes.toLocaleString('fr-BE')} codes officiels
                      </p>
                    </div>
                    <div className="flex items-center justify-end border-t pt-2.5 text-xs font-medium text-primary">
                      Explorer
                      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-end">
        <a
          href="https://services.onem.be/lookupweb/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline"
        >
          Référentiel ONEM officiel <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function CategoryTile({ slug, size = 'md' }: { slug: string; size?: 'sm' | 'md' }) {
  const skin = skinFor(slug)
  const Icon = skin.icon
  const box = size === 'sm' ? 'size-9 rounded-lg' : 'size-11 rounded-xl'
  const icon = size === 'sm' ? 'size-4' : 'size-5'
  return (
    <span className={`flex items-center justify-center ${box} ${skin.tile} shrink-0`}>
      <Icon className={icon} />
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

function TableGrid({
  tables,
  showCategory = false,
}: {
  tables: Array<LandingTable & { categoryLabel?: string; categorySlug?: string }>
  showCategory?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((t) => {
        const moduleInfo = getModuleInfo(t.prefix)
        return (
          <Link key={t.id} href={`/outils/lookup-onem/${t.slug}`} className="group">
            <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="size-4" />
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {t.prefix}
                  </Badge>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold leading-snug group-hover:text-primary">
                    {cleanTableLabel(t.labelFr, t.prefix)}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {showCategory && t.categoryLabel ? t.categoryLabel : moduleInfo.label}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.entriesCount.toLocaleString('fr-BE')} codes
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
