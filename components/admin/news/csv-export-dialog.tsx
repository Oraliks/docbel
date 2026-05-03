'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { exportNewsToCsv } from '@/utils/csv-export';
import { toast } from 'sonner';

interface News {
  id: string;
  title: string;
  emoji: string;
  category: string;
  status: string;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  readingTime?: number;
  featured?: boolean;
  slug: string;
}

interface CsvExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: News[];
  filters?: {
    statusFilter?: string;
    categoryFilter?: string;
    searchFilter?: string;
  };
}

const COLUMN_OPTIONS = [
  { id: 'title', label: 'Titre', checked: true },
  { id: 'category', label: 'Catégorie', checked: true },
  { id: 'status', label: 'Statut', checked: true },
  { id: 'published', label: 'Publié', checked: true },
  { id: 'views', label: 'Vues', checked: true },
  { id: 'readingTime', label: 'Temps de lecture', checked: true },
  { id: 'featured', label: 'Vedette', checked: true }
];

export function CsvExportDialog({
  open,
  onOpenChange,
  articles,
  filters = {}
}: CsvExportDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    COLUMN_OPTIONS.filter(col => col.checked).map(col => col.id)
  );
  const [statusFilter, setStatusFilter] = useState(filters.statusFilter || 'all');
  const [categoryFilter, setCategoryFilter] = useState(filters.categoryFilter || 'all');
  const [searchFilter, setSearchFilter] = useState(filters.searchFilter || '');
  const [isExporting, setIsExporting] = useState(false);

  // Get unique categories from articles
  const categories = Array.from(new Set(articles.map(a => a.category))).sort();

  // Filter articles based on dialog filters
  const filteredArticles = articles.filter(a => {
    const statusMatch = statusFilter === 'all' || a.status === statusFilter;
    const categoryMatch = categoryFilter === 'all' || a.category === categoryFilter;
    const searchMatch = searchFilter === '' ||
      a.title.toLowerCase().includes(searchFilter.toLowerCase());

    return statusMatch && categoryMatch && searchMatch;
  });

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const toggleAllColumns = () => {
    if (selectedColumns.length === COLUMN_OPTIONS.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(COLUMN_OPTIONS.map(col => col.id));
    }
  };

  const handleExport = async () => {
    if (selectedColumns.length === 0) {
      toast.error('Sélectionnez au moins une colonne');
      return;
    }

    if (filteredArticles.length === 0) {
      toast.error('Aucun article à exporter');
      return;
    }

    setIsExporting(true);
    try {
      // Show loading toast
      const toastId = toast.loading('Préparation du fichier CSV...');

      // Small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Export CSV
      exportNewsToCsv(filteredArticles, selectedColumns);

      // Replace loading toast with success
      toast.dismiss(toastId);
      toast.success(`CSV téléchargé (${filteredArticles.length} articles)`);

      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Erreur lors du téléchargement du fichier');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exporter les articles en CSV</DialogTitle>
          <DialogDescription>
            Sélectionnez les colonnes et les filtres avant de télécharger
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filtres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Recherche</label>
                <Input
                  placeholder="Titre..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Statut</label>
                  <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="published">Publié</SelectItem>
                      <SelectItem value="scheduled">Planifié</SelectItem>
                      <SelectItem value="archived">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium block mb-2">Catégorie</label>
                  <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val || 'all')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {categories.map((cat) => (
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

          {/* Columns Selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Colonnes à exporter</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllColumns}
                  className="h-8 text-xs"
                >
                  {selectedColumns.length === COLUMN_OPTIONS.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {COLUMN_OPTIONS.map((column) => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={selectedColumns.includes(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                    <Label
                      htmlFor={column.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {column.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <div className="rounded-lg border p-4 bg-blue-50">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-700">{filteredArticles.length}</span> article{filteredArticles.length !== 1 ? 's' : ''} seront exporté{filteredArticles.length !== 1 ? 's' : ''} avec {selectedColumns.length} colonne{selectedColumns.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isExporting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || selectedColumns.length === 0 || filteredArticles.length === 0}
          >
            {isExporting ? 'Préparation...' : 'Exporter CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
