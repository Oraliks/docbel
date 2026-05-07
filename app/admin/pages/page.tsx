'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageData } from '@/lib/page-builder/types'
import { PAGE_TEMPLATES, getTemplateBlocks } from '@/lib/page-builder/page-templates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Trash2, Eye, EyeOff, Copy } from 'lucide-react'

const ITEMS_PER_PAGE = 10

export default function PagesListPage() {
  const router = useRouter()
  const [pages, setPages] = useState<PageData[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [newPageTitle, setNewPageTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [isCreating, setIsCreating] = useState(false)

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/pages?limit=200&includeContent=1')
      const data = await res.json()
      const items: PageData[] = Array.isArray(data) ? data : data.items || []
      setPages(items)
    } catch (error) {
      console.error('Failed to fetch pages:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function load() { await fetchPages() }
    void load()
  }, [])

  const handlePublishToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/pages/${id}/publish`, {
        method: 'POST',
      })
      if (!res.ok) {
        toast.error('Erreur lors de la modification du statut')
        return
      }
      const updated = await res.json()
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p))
      )
      toast.success(
        updated.status === 'published' ? 'Page publiée' : 'Page dépubliée'
      )
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      toast.error('Erreur lors de la modification du statut')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/pages/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error('Erreur lors de la suppression')
        return
      }
      setPages((prev) => prev.filter((p) => p.id !== deleteId))
      setDeleteId(null)
      toast.success('Page supprimée')
    } catch (error) {
      console.error('Failed to delete page:', error)
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) {
      toast.error('Le titre de la page est requis')
      return
    }

    setIsCreating(true)
    try {
      const templateBlocks = getTemplateBlocks(selectedTemplate)
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPageTitle.trim(),
          content: templateBlocks,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Erreur lors de la création de la page')
        return
      }

      const newPage = await res.json()
      toast.success(`Page "${newPageTitle}" créée avec le modèle`)
      setShowCreateDialog(false)
      setShowTemplateDialog(false)
      setNewPageTitle('')
      setSelectedTemplate('blank')

      // Route to editor for the new page
      router.push(`/admin/pages/${newPage.id}`)
    } catch (error) {
      console.error('Failed to create page:', error)
      toast.error('Erreur lors de la création de la page')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    const pageToDuplicate = pages.find((p) => p.id === id)
    if (!pageToDuplicate) return

    try {
      // Fetch full content (the list endpoint returns metadata only)
      const fullRes = await fetch(`/api/pages/${id}`)
      if (!fullRes.ok) throw new Error('Failed to load source page')
      const full = await fullRes.json()

      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${pageToDuplicate.title} (Copie)`,
          content: full.blocks ?? [],
        }),
      })
      if (!res.ok) throw new Error('Failed to duplicate')

      await fetchPages()
      toast.success('Page dupliquée')
    } catch (error) {
      console.error('Failed to duplicate page:', error)
      toast.error('Erreur lors de la duplication de la page')
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>
  }

  // Pagination
  const totalPages = Math.ceil(pages.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedPages = pages.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pages</h1>
          <p className="text-muted-foreground mt-2">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          className=""
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Créer une page
        </Button>
      </div>

      {/* Table */}
      {pages.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">Aucune page créée</p>
          <Button
            className=""
            onClick={() => setShowCreateDialog(true)}
          >
            Créer la première page
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-1/3">Titre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Blocs</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPages.map((page) => (
                  <TableRow key={page.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {page.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {page.blocks?.length || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          page.status === 'published' ? 'default' : 'secondary'
                        }
                      >
                        {page.status === 'published' ? '✓ Publié' : '- Brouillon'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {/* Edit */}
                        <Link href={`/admin/pages/${page.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Éditer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>

                        {/* Publish Toggle */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePublishToggle(page.id)}
                          title={
                            page.status === 'published'
                              ? 'Dépublier'
                              : 'Publier'
                          }
                        >
                          {page.status === 'published' ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Duplicate */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(page.id)}
                          title="Dupliquer"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                          onClick={() => setDeleteId(page.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages} • {pages.length} pages
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Page Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer une nouvelle page</DialogTitle>
            <DialogDescription>
              Entrez le titre de la page et choisissez un modèle. Vous pourrez l&apos;éditer après la création.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titre de la page</label>
              <Input
                placeholder="Ex: À propos"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPageTitle.trim()) {
                    handleCreatePage()
                  }
                }}
                disabled={isCreating}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Modèle</label>
              <Button
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => setShowTemplateDialog(true)}
              >
                {PAGE_TEMPLATES.find((t) => t.id === selectedTemplate)?.name ||
                  'Choisir un modèle'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setNewPageTitle('')
              }}
              disabled={isCreating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreatePage}
              disabled={isCreating || !newPageTitle.trim()}
              className=""
            >
              {isCreating ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choisir un modèle</DialogTitle>
            <DialogDescription>
              Sélectionnez un modèle de page pour commencer rapidement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {PAGE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template.id)
                  setShowTemplateDialog(false)
                }}
                className={`p-4 border rounded-lg text-left transition-all ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <h3 className="font-semibold text-sm">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {template.description}
                </p>
                {template.blocks.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {template.blocks.length} bloc(s)
                  </p>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette page?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La page et tous ses blocs seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-4">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
