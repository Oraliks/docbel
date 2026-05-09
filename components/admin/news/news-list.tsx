'use client';

import { useState } from 'react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Edit, Trash2, MoreHorizontal, Eye, Copy, Star, ArrowUp, ArrowDown } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface News {
  id: string;
  title: string;
  emoji: string;
  category: string;
  color?: string;
  categoryColor?: string;
  status: string;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  readingTime?: number;
  featured?: boolean;
  slug: string;
}

function SortHeader({ label, field, sortable = true, sortBy, sortOrder, onSort }: {
  label: string;
  field?: string;
  sortable?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}) {
  if (!sortable) return <TableHead>{label}</TableHead>;
  const isActive = sortBy === field;
  const isAsc = sortOrder === 'asc';
  return (
    <TableHead
      onClick={() => onSort?.(field!)}
      className="cursor-pointer hover:bg-muted transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        {isActive && (isAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
      </div>
    </TableHead>
  );
}

interface NewsListProps {
  articles: News[];
  isLoading: boolean;
  onRefresh: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  currentPage?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  viewMode?: 'table' | 'grid';
}

export function NewsList({
  articles,
  isLoading,
  onRefresh,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onSort,
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  viewMode = 'table'
}: NewsListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'publish'|'unpublish'|'archive'|'delete'|null>(null);
  const [isBulkActioning, setIsBulkActioning] = useState(false);
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [prevArticles, setPrevArticles] = useState(articles);
  const [orderedArticles, setOrderedArticles] = useState<News[]>(articles);
  if (prevArticles !== articles) {
    setPrevArticles(articles);
    setOrderedArticles(articles);
  }

  // DnD Kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedArticles((items) => {
        const oldIndex = items.findIndex(a => a.id === active.id);
        const newIndex = items.findIndex(a => a.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/admin/news/${id}`);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteId(null);
        toast.success('Article supprimé');
        onRefresh();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreview = (slug: string) => {
    window.open(`/actualites/${slug}`, '_blank');
  };

  const handleDuplicate = async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/news/${id}`);
      const article = await res.json();

      const res2 = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...article,
          title: `${title} (Copie)`,
          slug: `${article.slug}-copy-${Date.now()}`,
          status: 'draft'
        })
      });

      if (res2.ok) {
        toast.success('Article dupliqué');
        onRefresh();
      }
    } catch (error) {
      console.error('Error duplicating article:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const toggleAllSelection = () => {
    if (selectedIds.length === articles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(articles.map(a => a.id));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;

    setIsBulkActioning(true);
    try {
      const res = await fetch('/api/news/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: bulkAction,
          ids: selectedIds
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count} articles ${bulkAction === 'delete' ? 'supprimés' : bulkAction === 'publish' ? 'publiés' : bulkAction === 'unpublish' ? 'dépubliés' : 'archivés'}`);
        setSelectedIds([]);
        setBulkAction(null);
        onRefresh();
      } else {
        toast.error('Erreur lors de l\'action en masse');
      }
    } catch (error) {
      console.error('Error bulk action:', error);
      toast.error('Erreur lors de l\'action en masse');
    } finally {
      setIsBulkActioning(false);
    }
  };

  const handleQuickStatusChange = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      const endpoint = newStatus === 'published' ? 'publish' : 'unpublish';

      const res = await fetch(`/api/news/${id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        toast.success(`Article ${newStatus === 'published' ? 'publié' : 'dépublié'}`);
        setStatusEditId(null);
        onRefresh();
      } else {
        toast.error('Erreur lors du changement de statut');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const handleToggleFeatured = async (id: string, currentFeatured: boolean) => {
    try {
      const res = await fetch(`/api/news/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !currentFeatured })
      });

      if (res.ok) {
        toast.success(currentFeatured ? 'Retiré des vedettes' : 'Ajouté aux vedettes');
        onRefresh();
      } else {
        toast.error('Erreur lors du changement');
      }
    } catch (error) {
      console.error('Error toggling featured:', error);
      toast.error('Erreur lors du changement');
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Keyboard shortcuts
  useKeyboardShortcut('e', () => {
    if (articles.length > 0) handleEdit(articles[0].id);
  }, true);

  useKeyboardShortcut('p', () => {
    if (articles.length > 0) handlePreview(articles[0].slug);
  }, true);

  useKeyboardShortcut('d', () => {
    if (articles.length > 0) handleDuplicate(articles[0].id, articles[0].title);
  }, true);

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-50 border-t border-blue-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium">{selectedIds.length} article{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Annuler</Button>
              <Button size="sm" variant="default" onClick={() => { setBulkAction('publish'); }} disabled={isBulkActioning}>Publier</Button>
              <Button size="sm" variant="default" onClick={() => { setBulkAction('unpublish'); }} disabled={isBulkActioning}>Dépublier</Button>
              <Button size="sm" variant="default" onClick={() => { setBulkAction('archive'); }} disabled={isBulkActioning}>Archiver</Button>
              <Button size="sm" variant="destructive" onClick={() => { setBulkAction('delete'); }} disabled={isBulkActioning}>Supprimer</Button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: selectedIds.length > 0 ? '120px' : '0' }}>
        {viewMode === 'table' ? (
          // TABLE VIEW
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={orderedArticles.length > 0 && selectedIds.length === orderedArticles.length}
                        onChange={toggleAllSelection}
                      />
                    </TableHead>
                    <TableHead className="w-12">Vedette</TableHead>
                    <SortHeader label="Titre" field="title" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                    <TableHead>Catégorie</TableHead>
                    <SortHeader label="Publié" field="publishedAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                    <TableHead className="text-right w-16">Temps</TableHead>
                    <SortHeader label="Vues" field="views" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedArticles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {isLoading ? 'Chargement...' : 'Aucun article trouvé'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext items={orderedArticles.map(a => a.id)} strategy={verticalListSortingStrategy}>
                      {orderedArticles.map((article) => (
                        <SortableTableRow
                          key={article.id}
                          article={article}
                          isSelected={selectedIds.includes(article.id)}
                          onToggleSelection={() => toggleSelection(article.id)}
                          onToggleFeatured={(featured) => handleToggleFeatured(article.id, featured)}
                          onEdit={() => handleEdit(article.id)}
                          onPreview={() => handlePreview(article.slug)}
                          onDuplicate={() => handleDuplicate(article.id, article.title)}
                          onDeleteClick={() => setDeleteId(article.id)}
                          formatDate={formatDate}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </div>
          </DndContext>
        ) : (
          // GRID VIEW
          <div>
            {articles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {isLoading ? 'Chargement...' : 'Aucun article trouvé'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {articles.map((article) => (
                  <Card key={article.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-3xl flex-shrink-0">{article.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <input
                              type="checkbox"
                              className="mr-2"
                              checked={selectedIds.includes(article.id)}
                              onChange={() => toggleSelection(article.id)}
                            />
                            <p className="font-semibold text-sm line-clamp-2 cursor-pointer hover:underline" onClick={() => handleEdit(article.id)}>
                              {article.title}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleFeatured(article.id, article.featured || false)}
                          className="hover:opacity-75 transition-opacity flex-shrink-0"
                        >
                          {article.featured ? (
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                          ) : (
                            <Star className="w-5 h-5 text-muted-foreground/50" />
                          )}
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          className="text-xs"
                          style={{
                            backgroundColor: article.categoryColor || '#7C3AED',
                            color: '#fff'
                          }}
                        >
                          {article.category}
                        </Badge>
                        <button onClick={() => setStatusEditId(article.id)}>
                          <StatusBadge status={article.status} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <p className="font-medium text-foreground">{article.views}</p>
                          <p>Vues</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{article.readingTime ? `${article.readingTime} min` : '-'}</p>
                          <p>Lecture</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground truncate">{formatDate(article.publishedAt)}</p>
                          <p>Publié</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(article.id)}>
                          <Edit className="w-3 h-3 mr-1" />
                          Modifier
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-9 w-9 p-0 hover:bg-muted rounded-md transition-colors inline-flex items-center justify-center border">
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handlePreview(article.slug)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Aperçu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(article.id, article.title)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteId(article.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {currentPage} sur {totalPages} • {totalItems} articles total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => onPageChange?.(currentPage - 1)}
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange?.(currentPage + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Supprimer l&apos;article?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action ne peut pas être annulée. L&apos;article sera supprimé définitivement.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={!!bulkAction} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {bulkAction === 'delete' && 'Supprimer les articles?'}
            {bulkAction === 'publish' && 'Publier les articles?'}
            {bulkAction === 'unpublish' && 'Dépublier les articles?'}
            {bulkAction === 'archive' && 'Archiver les articles?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Cette action affectera {selectedIds.length} article{selectedIds.length > 1 ? 's' : ''}.
            {bulkAction === 'delete' && ' Les articles seront supprimés définitivement.'}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              disabled={isBulkActioning}
              className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {isBulkActioning ? 'Traitement...' : 'Confirmer'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {articles.find(a => a.id === previewId)?.title || 'Aperçu'}
            </DialogTitle>
          </DialogHeader>
          {previewId && articles.find(a => a.id === previewId) && (() => {
            const article = articles.find(a => a.id === previewId)!;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{article.emoji}</span>
                  <div>
                    <p className="text-sm text-muted-foreground">{article.category}</p>
                    <p className="text-lg font-semibold">{article.title}</p>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">Statut</p>
                      <div className="mt-1">
                        <StatusBadge status={article.status} />
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lecture</p>
                      <p className="font-medium">{article.readingTime ? `${article.readingTime} min` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vues</p>
                      <p className="font-medium">{article.views}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Créé le</p>
                      <p className="font-medium">{formatDate(article.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Publié le</p>
                      <p className="font-medium">{formatDate(article.publishedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewId(null)}>
              Fermer
            </Button>
            <Button onClick={() => {
              if (previewId) handleEdit(previewId);
              setPreviewId(null);
            }}>
              Éditer cet article
            </Button>
            {previewId && (
              <Button variant="outline" onClick={() => {
                handlePreview(articles.find(a => a.id === previewId)?.slug || '');
                setPreviewId(null);
              }}>
                Voir le rendu
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Status Edit Dialog */}
      <Dialog open={!!statusEditId} onOpenChange={(open) => !open && setStatusEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
            <DialogDescription>
              Sélectionnez le nouveau statut pour cet article
            </DialogDescription>
          </DialogHeader>
          {statusEditId && (
            <div className="space-y-4">
              <Select
                defaultValue={articles.find(a => a.id === statusEditId)?.status || 'draft'}
                onValueChange={(newStatus) => {
                  const currentStatus = articles.find(a => a.id === statusEditId)?.status || 'draft';
                  if (newStatus !== currentStatus) {
                    handleQuickStatusChange(statusEditId, currentStatus);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="scheduled">Planifié</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusEditId(null)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Sortable table row component for drag-and-drop
function SortableTableRow({
  article,
  isSelected,
  onToggleSelection,
  onToggleFeatured,
  onEdit,
  onPreview,
  onDuplicate,
  onDeleteClick,
  formatDate
}: {
  article: News;
  isSelected: boolean;
  onToggleSelection: () => void;
  onToggleFeatured: (featured: boolean) => void;
  onEdit: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onDeleteClick: () => void;
  formatDate: (date: string | null) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`hover:bg-muted/50 ${isDragging ? 'bg-primary/10' : ''}`}
    >
      <TableCell className="w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors"
          title="Faites glisser pour réorganiser"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <input
          type="checkbox"
          className="rounded"
          checked={isSelected}
          onChange={onToggleSelection}
        />
      </TableCell>
      <TableCell className="text-center">
        <button
          onClick={() => onToggleFeatured(article.featured || false)}
          className="hover:opacity-75 transition-opacity"
          title={article.featured ? 'Retirer des vedettes' : 'Ajouter aux vedettes'}
        >
          {article.featured ? (
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          ) : (
            <Star className="w-4 h-4 text-muted-foreground/50" />
          )}
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{article.emoji}</span>
          <div>
            <p className="font-medium cursor-pointer hover:underline" onClick={onEdit}>
              {article.title}
            </p>
            <p className="text-sm text-muted-foreground">{formatDate(article.createdAt)}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          style={{
            backgroundColor: article.categoryColor || '#7C3AED',
            color: '#fff'
          }}
        >
          {article.category}
        </Badge>
      </TableCell>
      <TableCell>{formatDate(article.publishedAt)}</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {article.readingTime ? `${article.readingTime} min` : '-'}
      </TableCell>
      <TableCell className="text-right">{article.views}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 p-0 hover:bg-muted rounded-md transition-colors inline-flex items-center justify-center">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="w-4 h-4 mr-2" />
              Aperçu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="w-4 h-4 mr-2" />
              Dupliquer
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={onDeleteClick}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
