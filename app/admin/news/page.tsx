'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus, Download, Grid3x3, List } from 'lucide-react';
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

const CATEGORIES = [
  'Mise à jour',
  'Annonce ONEM',
  'CPAS',
  'Réforme'
];

export default function NewsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('published');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, setViewMode] = useState<'table'|'grid'>('table');
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ all: 0 });

  useEffect(() => {
    fetchArticles();
  }, [statusFilter, categoryFilter, search, sortBy, sortOrder, currentPage, itemsPerPage]);

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (search) params.append('search', search);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      params.append('page', currentPage.toString());
      params.append('limit', itemsPerPage.toString());

      const res = await fetch(`/api/news?${params.toString()}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotalItems(data.total || 0);
      if (data.statusCounts) setStatusCounts(data.statusCounts);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Erreur lors du chargement des articles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    router.push('/admin/news/new');
  };

  const handleRefresh = () => {
    fetchArticles();
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6 px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Articles & Blog</h1>
            <p className="text-gray-500 mt-1">Gérez vos actualités et articles</p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 border rounded-lg p-1 bg-gray-50">
              <Button
                onClick={() => setViewMode('table')}
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'table' ? 'bg-gray-900 hover:bg-gray-800' : 'hover:bg-gray-200'}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setViewMode('grid')}
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className={viewMode === 'grid' ? 'bg-gray-900 hover:bg-gray-800' : 'hover:bg-gray-200'}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
            </div>
            <Button
              onClick={() => setShowCsvDialog(true)}
              variant="outline"
              className="hover:bg-gray-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
            <Button onClick={handleCreateNew} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Créer un article
            </Button>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <Tabs
        value={statusFilter}
        onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
      >
        <TabsList className="h-auto gap-1 rounded-xl p-1">
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
                  className="h-5 min-w-5 px-1.5 text-xs rounded-full"
                >
                  {statusCounts[value]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium block mb-2">Rechercher</label>
              <Input
                placeholder="Titre, description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48">
              <label className="text-sm font-medium block mb-2">Catégorie</label>
              <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles List */}
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
        onPageChange={setCurrentPage}
        viewMode={viewMode}
      />

      {/* CSV Export Dialog */}
      <CsvExportDialog
        open={showCsvDialog}
        onOpenChange={setShowCsvDialog}
        articles={articles}
        filters={{
          statusFilter,
          categoryFilter,
          searchFilter: search
        }}
      />
    </div>
  );
}
