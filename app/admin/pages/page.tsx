'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageData } from '@/lib/page-builder/types'
import { getTemplateBlocks } from '@/lib/page-builder/page-templates'
import { CreatePageDialogs } from './_components/create-page-dialogs'
import { DeletePagesDialogs } from './_components/delete-pages-dialogs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Search,
  Upload,
  X,
} from 'lucide-react'

const ITEMS_PER_PAGE = 10

type StatusFilter = 'all' | 'published' | 'draft'

/**
 * `scheduledAt` lives on the API payload but isn't on the shared `PageData`
 * type (lib/page-builder/types.ts, out of scope here), so read it via a local
 * cast and format it for the "Planifié" badge.
 */
function formatScheduledAt(page: PageData): string {
  const iso = (page as { scheduledAt?: string | null }).scheduledAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PagesListPage() {
  const t = useTranslations('admin.pages')
  const router = useRouter()
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [pages, setPages] = useState<PageData[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [deleteTyped, setDeleteTyped] = useState('')
  // Reset du champ type-to-confirm à chaque ouverture/fermeture d'un dialog de suppression.
  useEffect(() => {
    setDeleteTyped('')
  }, [deleteId, bulkDeleteOpen])
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [newPageTitle, setNewPageTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [isCreating, setIsCreating] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchPages = async () => {
    try {
      const res = await fetch('/api/pages?limit=200')
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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/page-views')
        if (!res.ok) return
        const data = await res.json()
        setViewCounts(data.counts ?? {})
      } catch {
        // analytics non bloquant
      }
    })()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  const handlePublishToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/pages/${id}/publish`, {
        method: 'POST',
      })
      if (!res.ok) {
        toast.error(t('toastStatusError'))
        return
      }
      const updated = await res.json()
      setPages((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: updated.status } : p))
      )
      toast.success(
        updated.status === 'published' ? t('toastPublished') : t('toastUnpublished')
      )
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      toast.error(t('toastStatusError'))
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/pages/${deleteId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        toast.error(t('toastDeleteError'))
        return
      }
      setPages((prev) => prev.filter((p) => p.id !== deleteId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(deleteId)
        return next
      })
      setDeleteId(null)
      toast.success(t('toastDeleted'))
    } catch (error) {
      console.error('Failed to delete page:', error)
      toast.error(t('toastDeleteError'))
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    try {
      const res = await fetch('/api/pages/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action: 'delete' }),
      })
      if (!res.ok) {
        toast.error(t('toastDeleteError'))
        return
      }
      const { deleted } = await res.json()
      setPages((prev) => prev.filter((p) => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
      setBulkDeleteOpen(false)
      toast.success(t('toastBulkDeleted', { count: deleted }))
    } catch (error) {
      console.error('Failed to bulk delete:', error)
      toast.error(t('toastDeleteError'))
    }
  }

  const handleBulkPublishToggle = async (target: 'published' | 'draft') => {
    const ids = Array.from(selectedIds).filter((id) => {
      const p = pages.find((pp) => pp.id === id)
      return p && p.status !== target
    })
    if (ids.length === 0) {
      toast.info(target === 'published' ? t('toastAllPublished') : t('toastAllDraft'))
      return
    }
    try {
      const res = await fetch('/api/pages/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          action: target === 'published' ? 'publish' : 'unpublish',
        }),
      })
      if (!res.ok) {
        toast.error(t('toastUpdateError'))
        return
      }
      const { updated } = await res.json()
      const idSet = new Set(ids)
      setPages((prev) =>
        prev.map((p) => (idSet.has(p.id) ? { ...p, status: target } : p))
      )
      toast.success(
        target === 'published'
          ? t('toastBulkPublished', { count: updated })
          : t('toastBulkUnpublished', { count: updated })
      )
    } catch (error) {
      console.error('Failed to bulk toggle:', error)
      toast.error(t('toastUpdateError'))
    }
  }

  const importInputRef = React.useRef<HTMLInputElement>(null)

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const blocks = Array.isArray(data?.blocks)
        ? data.blocks
        : Array.isArray(data?.content)
          ? data.content
          : null
      if (!blocks) {
        toast.error(t('toastImportInvalid'))
        return
      }
      const title =
        (typeof data?.title === 'string' && data.title.trim()) ||
        file.name.replace(/\.json$/i, '') ||
        t('importedPageFallback')
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: blocks }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || t('toastImportError'))
        return
      }
      const newPage = await res.json()
      toast.success(t('toastImported', { title }))
      router.push(`/admin/pages/${newPage.id}`)
    } catch {
      toast.error(t('toastImportUnreadable'))
    }
  }

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) {
      toast.error(t('toastTitleRequired'))
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
        toast.error(error.error || t('toastCreateError'))
        return
      }

      const newPage = await res.json()
      toast.success(t('toastCreated', { title: newPageTitle }))
      setShowCreateDialog(false)
      setShowTemplateDialog(false)
      setNewPageTitle('')
      setSelectedTemplate('blank')

      // Route to editor for the new page
      router.push(`/admin/pages/${newPage.id}`)
    } catch (error) {
      console.error('Failed to create page:', error)
      toast.error(t('toastCreateError'))
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
          title: `${full.title ?? pageToDuplicate.title} (copie)`,
          content: full.blocks ?? [],
        }),
      })
      if (!res.ok) throw new Error('Failed to duplicate')

      const newPage = await res.json()
      toast.success(t('toastDuplicated'))
      router.push(`/admin/pages/${newPage.id}`)
    } catch (error) {
      console.error('Failed to duplicate page:', error)
      toast.error(t('toastDuplicateError'))
    }
  }

  // Filter pages by search + status
  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pages.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      )
    })
  }, [pages, search, statusFilter])

  // Pagination (on filtered)
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIdx = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedPages = filteredPages.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  const allVisibleSelected =
    paginatedPages.length > 0 && paginatedPages.every((p) => selectedIds.has(p.id))
  const someVisibleSelected =
    !allVisibleSelected && paginatedPages.some((p) => selectedIds.has(p.id))

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        paginatedPages.forEach((p) => next.add(p.id))
      } else {
        paginatedPages.forEach((p) => next.delete(p.id))
      }
      return next
    })
  }

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  if (loading) {
    return <div className="p-8">{t('loading')}</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('pagesCount', { count: pages.length })}
            {(search || statusFilter !== 'all') && (
              <> · {t('resultsCount', { count: filteredPages.length })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            {t('importJson')}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('createPage')}
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      {pages.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label={t('clearSearch')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              {t('filterAll', { count: pages.length })}
            </Button>
            <Button
              variant={statusFilter === 'published' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('published')}
            >
              {t('filterPublished', { count: pages.filter((p) => p.status === 'published').length })}
            </Button>
            <Button
              variant={statusFilter === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('draft')}
            >
              {t('filterDraft', { count: pages.filter((p) => p.status === 'draft').length })}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border rounded-lg bg-muted/40">
          <div className="text-sm">
            {t.rich('selectedCount', {
              count: selectedIds.size,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkPublishToggle('published')}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              {t('publish')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkPublishToggle('draft')}
            >
              <EyeOff className="h-4 w-4 mr-1.5" />
              {t('unpublish')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {t('delete')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {pages.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">{t('emptyNoPages')}</p>
          <Button
            className=""
            onClick={() => setShowCreateDialog(true)}
          >
            {t('createFirstPage')}
          </Button>
        </div>
      ) : filteredPages.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-2">{t('emptyNoMatch')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          >
            {t('resetFilters')}
          </Button>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAllVisible(checked)
                      }
                      aria-label={t('selectAll')}
                    />
                  </TableHead>
                  <TableHead className="w-1/3">{t('colTitle')}</TableHead>
                  <TableHead>{t('colSlug')}</TableHead>
                  <TableHead className="text-center">{t('colBlocks')}</TableHead>
                  <TableHead className="text-center">{t('colStatus')}</TableHead>
                  <TableHead className="text-right">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPages.map((page) => (
                  <TableRow
                    key={page.id}
                    className={`hover:bg-muted/50 ${selectedIds.has(page.id) ? 'bg-muted/30' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(page.id)}
                        onCheckedChange={(checked) =>
                          toggleRow(page.id, checked)
                        }
                        aria-label={t('selectRow', { title: page.title })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {page.title}
                      {(viewCounts[page.slug] ?? 0) > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          👁 {viewCounts[page.slug]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {page.slug}
                      </code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {page.blockCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {page.status === 'scheduled' ? (
                        <Badge variant="info" title={formatScheduledAt(page)}>
                          {formatScheduledAt(page)
                            ? t('badgeScheduledAt', { date: formatScheduledAt(page) })
                            : t('badgeScheduled')}
                        </Badge>
                      ) : (
                        <Badge
                          variant={
                            page.status === 'published' ? 'default' : 'secondary'
                          }
                        >
                          {page.status === 'published' ? t('badgePublished') : t('badgeDraft')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {/* Edit */}
                        <Link href={`/admin/pages/${page.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            title={t('actionEdit')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>

                        {/* Open on front */}
                        <a
                          href={`/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            title={t('actionView')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>

                        {/* Publish Toggle */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePublishToggle(page.id)}
                          title={
                            page.status === 'published'
                              ? t('unpublish')
                              : t('publish')
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
                          title={t('actionDuplicate')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                          onClick={() => setDeleteId(page.id)}
                          title={t('delete')}
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
                {t('paginationInfo', {
                  current: safeCurrentPage,
                  total: totalPages,
                  count: filteredPages.length,
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                >
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safeCurrentPage === totalPages}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <CreatePageDialogs
        createOpen={showCreateDialog}
        onCreateOpenChange={setShowCreateDialog}
        templateOpen={showTemplateDialog}
        onTemplateOpenChange={setShowTemplateDialog}
        title={newPageTitle}
        onTitleChange={setNewPageTitle}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
        isCreating={isCreating}
        onCreate={handleCreatePage}
      />

      <DeletePagesDialogs
        deleteOpen={deleteId !== null}
        onDeleteOpenChange={() => setDeleteId(null)}
        onConfirmDelete={handleDelete}
        bulkOpen={bulkDeleteOpen}
        onBulkOpenChange={setBulkDeleteOpen}
        bulkCount={selectedIds.size}
        onConfirmBulkDelete={handleBulkDelete}
        typed={deleteTyped}
        onTypedChange={setDeleteTyped}
      />
    </div>
  )
}
