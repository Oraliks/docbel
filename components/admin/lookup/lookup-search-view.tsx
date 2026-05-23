'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface SearchResult {
  id: string
  code: string
  labelFr: string
  labelNl: string
  labelDe: string | null
  labelEn: string | null
  validFrom: string | null
  validUntil: string | null
  similarity: number
  table: {
    slug: string
    labelFr: string
    prefix: string
    category: { slug: string; labelFr: string }
  }
}

interface Category {
  slug: string
  labelFr: string
}

type LangCode = 'fr' | 'nl' | 'de' | 'en'

export function LookupSearchView() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params?.get('q') ?? '')
  const [categoryFilter, setCategoryFilter] = useState<string>(params?.get('cat') ?? 'all')
  const [displayLang, setDisplayLang] = useState<LangCode>((params?.get('lang') as LangCode) ?? 'fr')
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch('/api/lookup/tables')
      .then((r) => r.json())
      .then((data: { categories: Category[] }) => setCategories(data.categories ?? []))
      .catch(() => {})
  }, [])

  const runSearch = useCallback(
    async (query: string, cat: string) => {
      if (!query || query.length < 2) {
        setResults([])
        setTotal(0)
        return
      }
      setLoading(true)
      try {
        const usp = new URLSearchParams({ q: query })
        if (cat !== 'all') usp.set('categorySlug', cat)
        const res = await fetch(`/api/lookup/search?${usp.toString()}`)
        if (!res.ok) throw new Error('Échec recherche')
        const data = await res.json()
        setResults(data.results ?? [])
        setTotal(data.total ?? 0)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Sync URL avec les filtres (en préservant le ?tab=search)
  useEffect(() => {
    const usp = new URLSearchParams(params?.toString() ?? '')
    if (q) usp.set('q', q)
    else usp.delete('q')
    if (categoryFilter !== 'all') usp.set('cat', categoryFilter)
    else usp.delete('cat')
    if (displayLang !== 'fr') usp.set('lang', displayLang)
    else usp.delete('lang')
    router.replace(usp.toString() ? `?${usp.toString()}` : '?', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoryFilter, displayLang])

  // Debounce search 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(q, categoryFilter)
    }, 250)
    return () => clearTimeout(timer)
  }, [q, categoryFilter, runSearch])

  const displayLabel = (r: SearchResult): string => {
    if (displayLang === 'nl') return r.labelNl || r.labelFr
    if (displayLang === 'de') return r.labelDe ?? r.labelFr
    if (displayLang === 'en') return r.labelEn ?? r.labelFr
    return r.labelFr
  }

  const makeHighlighter = (query: string) => {
    if (!query || query.length < 2) return (s: string) => s
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (s: string) => {
      if (!s) return s
      const re = new RegExp(`(${escaped})`, 'gi')
      return s.split(re).map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 dark:text-yellow-50 px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )
    }
  }
  const highlight = makeHighlighter(q)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Recherche fuzzy sur les 11 000+ entrées (pg_trgm). Tolère les fautes de
        frappe. Tape un code ou un libellé en FR/NL/DE/EN.
      </p>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Code, libellé… (min. 2 caractères)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v ?? 'all')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toutes catégories">
                {(value) => {
                  if (!value || value === 'all') return 'Toutes catégories'
                  const c = categories.find((cat) => cat.slug === value)
                  return c?.labelFr ?? value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Toutes catégories">
                Toutes catégories
              </SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug} label={c.labelFr}>
                  {c.labelFr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-md border overflow-hidden">
            {(['fr', 'nl', 'de', 'en'] as LangCode[]).map((l) => (
              <button
                key={l}
                onClick={() => setDisplayLang(l)}
                className={`px-2 py-1 text-[10px] uppercase font-medium ${
                  displayLang === l
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading && results.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Recherche…
        </div>
      ) : results.length === 0 ? (
        q && q.length >= 2 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Aucun résultat pour <code className="font-mono">{q}</code>.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Tape au moins 2 caractères pour lancer la recherche.
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Code</TableHead>
                  <TableHead>Libellé ({displayLang.toUpperCase()})</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead className="w-24 text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/admin/chomage/lookup/${r.table.slug}`}
                        className="hover:underline"
                      >
                        {highlight(r.code)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {highlight(displayLabel(r))}
                      {r.validUntil && new Date(r.validUntil) < new Date() && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-orange-300 text-orange-800">
                          expiré
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="font-mono text-[10px] mr-2">
                        {r.table.prefix}
                      </Badge>
                      <span className="text-muted-foreground">{r.table.category.labelFr}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>{r.table.labelFr}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {(r.similarity * 100).toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {results.length > 0 && (
              <div className="p-3 text-xs text-muted-foreground border-t">
                {total} résultat{total > 1 ? 's' : ''} — triés par pertinence
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
