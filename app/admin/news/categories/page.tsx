'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { CategoriesDialog } from '@/components/admin/categories-dialog';
import { SmartImage } from '@/components/ui/smart-image';

interface Category {
  id: string;
  name: string;
  color: string;
  illustrationUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CategoriesPage() {
  const t = useTranslations('admin.news');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  // Catégorie ciblée par le dialog. `null` = mode création ; sinon = édition.
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) setCategories(data);
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching categories:', error);
        toast.error(t('catLoadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTick, t]);

  const refreshCategories = useCallback(() => setRefreshTick((t) => t + 1), []);

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(t('catDeleteConfirm', { name }))) {
      return;
    }

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success(t('catDeleted'));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('catDeleteError'));
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(t('catDeleteError'));
    }
  };

  const handleCategoriesUpdated = () => {
    setShowDialog(false);
    refreshCategories();
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('catTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('catSubtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setShowDialog(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('catCreate')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('catExistingTitle')}</CardTitle>
          <CardDescription>
            {t('catCreatedCount', { n: categories.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">{t('catEmpty')}</p>
              <Button
                onClick={() => {
                  setEditingCategory(null);
                  setShowDialog(true);
                }}
                variant="outline"
                size="sm"
              >
                {t('catCreateFirst')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('catColColor')}</TableHead>
                  <TableHead>{t('catColName')}</TableHead>
                  <TableHead>Illustration</TableHead>
                  <TableHead>{t('catColCreatedAt')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: category.color }}
                          title={category.color}
                        />
                        <code className="text-xs text-muted-foreground">{category.color}</code>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell>
                      {category.illustrationUrl ? (
                        <div className="relative w-10 h-10 rounded overflow-hidden">
                          <SmartImage
                            src={category.illustrationUrl}
                            alt={`Illustration ${category.name}`}
                            type="generic"
                            fit="contain"
                            compactFallback
                            className="absolute inset-0"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(category.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setShowDialog(true);
                          }}
                          title={t('edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CategoriesDialog
        open={showDialog}
        onOpenChange={(open) => {
          setShowDialog(open);
          // Reset à la fermeture pour ne pas conserver une édition orpheline.
          if (!open) setEditingCategory(null);
        }}
        onCategoriesUpdated={handleCategoriesUpdated}
        category={editingCategory}
      />
    </div>
  );
}
