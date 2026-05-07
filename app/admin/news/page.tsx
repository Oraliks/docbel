'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Download, Grid3x3, List, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { NewsList } from '@/components/admin/news/news-list';
import { CsvExportDialog } from '@/components/admin/news/csv-export-dialog';

interface News {
  id: string;
  title: string;
  slug: string;
  emoji: string;
  category: string;
  status: string;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  readingTime?: number;
  featured?: boolean;
  scheduledAt?: string | null;
}

interface NewsResponse {
  articles?: News[];
  total?: number;
  statusCounts?: Record<string, number>;
}

const CATEGORIES = ['Mise à jour', 'Annonce ONEM', 'CPAS', 'Réforme'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function NewsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('published');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ all: 0 });

  // Debounce search to avoid spamming the API. Resetting the page lives here too.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = search.trim();
        if (prev !== next) setCurrentPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const updateStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const updateCategoryFilter = useCallback((value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  }, []);

  const updateItemsPerPage = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (categoryFilter !== 'all') params.append('category', categoryFilter);
    if (debouncedSearch) params.append('search', debouncedSearch);
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);
    params.append('page', currentPage.toString());
    params.append('limit', itemsPerPage.toString());
    return params.toString();
  }, [categoryFilter, currentPage, debouncedSearch, itemsPerPage, sortBy, sortOrder, statusFilter]);

  const [refreshTick, setRefreshTick] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;

    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/news?${queryString}`);
        if (!res.ok) throw new Error('Failed');
        const data = (await res.json()) as NewsResponse;
        if (cancelled || requestId !== requestIdRef.current) return;
        setArticles(data.articles || []);
        setTotalItems(data.total || 0);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching articles:', error);
        toast.error('Erreur lors du chargement des articles');
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryString, refreshTick]);

  const handleRefresh = useCallback(() => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  const handleCreateNew = () => router.push('/admin/news/new');

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilters = search.trim().length > 0 || categoryFilter !== 'all';
  const totalCount = statusCounts.all ?? totalItems;

  const statCards = useMemo(
    () => [
      { label: 'Tous', value: totalCount, tone: 'bg-muted/50 border-border' },
      { label: 'Publiés', value: statusCounts.published ?? 0, tone: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900' },
      { label: 'Brouillons', value: statusCounts.draft ?? 0, tone: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
      { label: 'Planifiés', value: statusCounts.scheduled ?? 0, tone: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900' },
    ],
    [statusCounts, totalCount]
  );

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Articles & Blog</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Gérez vos actualités, leur état de publication et leur diffusion depuis une seule vue.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
              <Button
                onClick={() => setViewMode('table')}
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'table' ? '' : 'hover:bg-muted'}
                aria-label="Vue tableau"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setViewMode('grid')}
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'grid' ? '' : 'hover:bg-muted'}
                aria-label="Vue grille"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={() => setShowCsvDialog(true)} variant="outline" className="hover:bg-muted">
              <Download className="mr-2 h-4 w-4" />
              Exporter CSV
            </Button>

            <Button onClick={handleCreateNew} className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600">
              <Plus className="mr-2 h-4 w-4" />
              Créer un article
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.tone}`}>
              <p className="text-sm font-medium text-foreground/80">{card.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <Tabs value={statusFilter} onValueChange={updateStatusFilter}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'draft', label: 'Brouillons' },
            { value: 'published', label: 'Publiés' },
            { value: 'scheduled', label: 'Planifiés' },
            { value: 'archived', label: 'Archivés' },
          ].map(({ value, label }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2">
              {label}
              {(statusCounts[value] ?? 0) > 0 && (
                <Badge
                  variant={statusFilter === value ? 'default' : 'secondary'}
                  className="h-5 min-w-5 rounded-full px-1.5 text-xs"
                >
                  {statusCounts[value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium" htmlFor="news-search">Rechercher</label>
              <Input
                id="news-search"
                placeholder="Titre, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="w-full xl:w-56">
              <label className="mb-2 block text-sm font-medium">Catégorie</label>
              <Select value={categoryFilter} onValueChange={(value) => updateCategoryFilter(value ?? 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full xl:w-40">
              <label className="mb-2 block text-sm font-medium">Par page</label>
              <Select value={itemsPerPage.toString()} onValueChange={(value) => updateItemsPerPage(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearch('');
                    updateCategoryFilter('all');
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Réinitialiser
                </Button>
              )}

              <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {totalItems} résultat{totalItems > 1 ? 's' : ''} affiché{totalItems > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <NewsList
        articles={articles}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        viewMode={viewMode}
      />

      <CsvExportDialog
        open={showCsvDialog}
        onOpenChange={setShowCsvDialog}
        articles={articles}
        filters={{
          statusFilter,
          categoryFilter,
          searchFilter: search,
        }}
      />
    </div>
  );
}
