'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, ListFilter, Loader2, Search } from 'lucide-react'
import { parseOnemCode, type CodeAnatomy } from '@/lib/lookup/parseOnemCode'
import 'flag-icons/css/flag-icons.min.css'
import { COLUMNS, type CategoryInfo, type SearchResult } from './lookup/types'
import { groupResultsByTable } from './lookup/group-results'
import { makeHighlighter } from './lookup/highlight'
import { FilterBar } from './lookup/filter-bar'
import { AnatomyPanel } from './lookup/anatomy-panel'
import { ResultSection } from './lookup/result-section'

interface Props {
  initialQ: string
  initialCategory: string
}

export function LookupOnemSearch({ initialQ, initialCategory }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(initialQ)
  // Le filtre "Catégorie" côté UI correspond techniquement à une table (slug).
  const [tableSlug, setTableSlug] = useState(
    initialCategory && initialCategory !== 'all' ? initialCategory : ''
  )
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  // Colonnes affichées : fixé via COLUMNS.defaultVisible (plus de picker partenaire)
  const visibleCols = new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Slugs des sections explicitement repliées (état "tout déplié" par défaut).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/lookup/tables')
      .then((r) => r.json())
      .then((data: { categories: CategoryInfo[] }) => setCategories(data.categories ?? []))
      .catch(() => {})
  }, [])

  const runSearch = useCallback(async (query: string, table: string) => {
    // On lance la requête si on a soit une query >= 2 chars, soit un module
    // sélectionné (mode browse — l'API retourne toutes les entrées du module).
    const hasQuery = query.length >= 2
    if (!hasQuery && !table) {
      setResults([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      const usp = new URLSearchParams()
      if (hasQuery) usp.set('q', query)
      if (table) usp.set('tableSlug', table)
      // En mode browse, augmenter la limite pour voir plus d'entrées
      if (!hasQuery && table) usp.set('limit', '200')
      const res = await fetch(`/api/lookup/search?${usp.toString()}`)
      if (!res.ok) throw new Error('Échec recherche')
      const data = await res.json()
      setResults(data.results ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync URL (un seul paramètre "cat" = slug table sélectionnée).
  useEffect(() => {
    const usp = new URLSearchParams()
    if (q) usp.set('q', q)
    if (tableSlug) usp.set('cat', tableSlug)
    router.replace(usp.toString() ? `?${usp.toString()}` : '?', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tableSlug])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => void runSearch(q, tableSlug), 250)
    return () => clearTimeout(timer)
  }, [q, tableSlug, runSearch])

  const toggleExpanded = (id: string) => setExpanded((prev) => toggleInSet(prev, id))
  const toggleSection = (slug: string) => setCollapsed((prev) => toggleInSet(prev, slug))

  const tablesInScope = categories.flatMap((c) =>
    c.tables.map((t) => ({ ...t, categoryLabel: c.labelFr }))
  )
  const anatomy: CodeAnatomy | null = q.length >= 2 ? parseOnemCode(q) : null
  const groups = groupResultsByTable(results)
  const highlight = makeHighlighter(q)

  return (
    <div className="space-y-4 w-full">
      <FilterBar
        q={q}
        onQChange={setQ}
        tablesInScope={tablesInScope}
        tableSlug={tableSlug}
        onTableSlugChange={setTableSlug}
      />

      {anatomy && (
        <AnatomyPanel
          anatomy={anatomy}
          activeTableSlug={tableSlug}
          tablesInScope={tablesInScope}
          onPickTable={setTableSlug}
        />
      )}

      {loading && results.length === 0 ? (
        <LoadingState />
      ) : results.length === 0 ? (
        <EmptyState q={q} />
      ) : (
        <>
          <ResultsHeader
            total={total}
            sectionCount={groups.length}
            canBulkToggle={groups.length > 1}
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() => setCollapsed(new Set(groups.map((g) => g.tableSlug)))}
          />
          {groups.map((g) => (
            <ResultSection
              key={g.tableSlug}
              group={g}
              collapsed={collapsed.has(g.tableSlug)}
              onToggleCollapse={() => toggleSection(g.tableSlug)}
              visibleCols={visibleCols}
              expandedIds={expanded}
              onToggleRow={toggleExpanded}
              highlight={highlight}
              activeTableSlug={tableSlug}
              onPickOnly={setTableSlug}
            />
          ))}
          <FooterLink />
        </>
      )}
    </div>
  )
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      Recherche…
    </div>
  )
}

function EmptyState({ q }: { q: string }) {
  if (q && q.length >= 2) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          <p>
            Aucun résultat pertinent pour <code className="font-mono">{q}</code>.
          </p>
          <p className="text-xs mt-2">
            Essaie un autre terme ou vérifie l&apos;orthographe du code.
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <Search className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Tape au moins 2 caractères pour rechercher dans les 11 000+ codes ONEM.
        </p>
        <p className="text-xs text-muted-foreground">
          Exemples : <code className="bg-muted px-1 rounded">44</code> ·{' '}
          <code className="bg-muted px-1 rounded">cohabitant</code> ·{' '}
          <code className="bg-muted px-1 rounded">brux</code> ·{' '}
          <code className="bg-muted px-1 rounded">01/43AA1</code> ·{' '}
          <code className="bg-muted px-1 rounded">S04</code>
        </p>
      </CardContent>
    </Card>
  )
}

interface ResultsHeaderProps {
  total: number
  sectionCount: number
  canBulkToggle: boolean
  onExpandAll: () => void
  onCollapseAll: () => void
}

function ResultsHeader({
  total,
  sectionCount,
  canBulkToggle,
  onExpandAll,
  onCollapseAll,
}: ResultsHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground px-1">
      <span className="inline-flex items-center gap-2">
        <ListFilter className="w-3.5 h-3.5" />
        {total} résultat{total > 1 ? 's' : ''} pertinent{total > 1 ? 's' : ''} dans {sectionCount}{' '}
        table{sectionCount > 1 ? 's' : ''}
      </span>
      {canBulkToggle && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onExpandAll}
            className="h-7 px-2 text-xs"
          >
            Tout déplier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onCollapseAll}
            className="h-7 px-2 text-xs"
          >
            Tout replier
          </Button>
        </div>
      )}
    </div>
  )
}

function FooterLink() {
  return (
    <div className="px-1 py-2 text-xs text-muted-foreground flex items-center justify-end">
      <a
        href="https://services.onem.be/lookupweb/"
        target="_blank"
        rel="noreferrer"
        className="text-xs underline inline-flex items-center gap-1"
      >
        Référentiel ONEM officiel <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}
