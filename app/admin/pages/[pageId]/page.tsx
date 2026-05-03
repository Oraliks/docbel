'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageEditor } from '@/components/page-builder/page-editor'
import { PageData, BlockProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface PageEditorPageProps {
  params: Promise<{
    pageId: string
  }>
}

export default function PageEditorPage({ params }: PageEditorPageProps) {
  const router = useRouter()
  const { page, setPage, setBlocks, setIsSaving: setStoreSaving } = usePageBuilderStore()
  const [pageId, setPageId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [ogImage, setOgImage] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    const initializePageId = async () => {
      const { pageId } = await params
      setPageId(pageId)
      await fetchPage(pageId)
    }
    initializePageId()
  }, [])

  const fetchPage = async (id: string) => {
    try {
      const res = await fetch(`/api/pages/${id}`)
      if (!res.ok) throw new Error('Page not found')
      const data = await res.json()
      setPage(data)
      setBlocks(data.blocks || [])
      setTitle(data.title)
      setSlug(data.slug)
      setMetaTitle(data.metaTitle || '')
      setMetaDesc(data.metaDesc || '')
      setOgImage(data.ogImage || '')
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to fetch page:', error)
      toast.error('Impossible de charger la page')
      router.push('/admin/pages')
    } finally {
      setLoading(false)
    }
  }

  const autoSave = useCallback(
    async (dataToSave: {
      title: string
      blocks?: BlockProps[]
      slug?: string
      metaTitle?: string | null
      metaDesc?: string | null
      ogImage?: string | null
    }) => {
      if (!page) return

      try {
        setIsSaving(true)
        const payload: any = { title: dataToSave.title }

        if (dataToSave.blocks) payload.content = dataToSave.blocks
        if (dataToSave.slug !== undefined) payload.slug = dataToSave.slug
        if (dataToSave.metaTitle !== undefined) payload.metaTitle = dataToSave.metaTitle
        if (dataToSave.metaDesc !== undefined) payload.metaDesc = dataToSave.metaDesc
        if (dataToSave.ogImage !== undefined) payload.ogImage = dataToSave.ogImage

        const res = await fetch(`/api/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          try {
            const error = await res.json()
            console.error('Save error:', error)
            toast.error(error.error || 'Erreur lors de la sauvegarde')
          } catch {
            console.error('Save error: Invalid response')
            toast.error('Erreur lors de la sauvegarde')
          }
          return
        }

        const updated = await res.json()
        setPage(updated)
        setLastSaved(new Date())
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Erreur lors de la sauvegarde')
      } finally {
        setIsSaving(false)
      }
    },
    [page]
  )

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave({ title: newTitle })
    }, 1000)
  }

  const handleSlugChange = (newSlug: string) => {
    // Remove leading slash if present
    const cleanSlug = newSlug.startsWith('/') ? newSlug.slice(1) : newSlug
    setSlug(cleanSlug)

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      autoSave({ title, slug: cleanSlug })
    }, 1000)
  }

  const handleSaveBlocks = useCallback(async (blocks: BlockProps[]) => {
    if (!page) return
    setBlocks(blocks)
    await autoSave({ title, blocks })
  }, [page, title, autoSave, setBlocks])

  const handleQuit = useCallback(() => {
    // Auto-save is already active and will save pending changes
    // Just navigate back to pages list
    router.push('/admin/pages')
  }, [router])

  const handleTogglePublish = useCallback(async () => {
    if (!page) return
    const newStatus = page.status === 'published' ? 'draft' : 'published'
    setIsSaving(true)
    try {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPage(updated)
        toast.success(newStatus === 'published' ? 'Page publiée' : 'Page mise en brouillon')
      } else {
        toast.error('Erreur lors du changement d\'état')
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      toast.error('Erreur lors du changement d\'état')
    } finally {
      setIsSaving(false)
    }
  }, [page])

  const handleSaveSettings = async () => {
    if (!page) return
    await autoSave({
      title,
      slug,
      metaTitle: metaTitle || null,
      metaDesc: metaDesc || null,
      ogImage: ogImage || null,
    })
    toast.success('Paramètres sauvegardés')
    setShowSettingsDialog(false)
  }

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Header Skeleton */}
        <div className="border-b bg-card">
          <div className="flex items-center justify-between p-4 gap-4">
            <Skeleton className="h-10 w-10 rounded" />

            <div className="flex-1 min-w-0 flex flex-col items-center gap-2 max-w-2xl">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-8 w-2/3 rounded-lg" />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Skeleton className="h-6 w-16 rounded" />
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          </div>
        </div>

        {/* Editor Area Skeleton */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Page non trouvée</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between p-4 gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/pages')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0 flex flex-col items-center gap-2 max-w-2xl">
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titre de la page"
              className="w-full text-2xl font-bold h-8 px-3 py-1 shadow-none focus-visible:ring-2 placeholder:text-muted-foreground text-center border border-input rounded-lg"
            />
            <Input
              value={`/${slug}`}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="/mon-slug"
              className="w-full text-sm h-8 px-3 py-1 shadow-none focus-visible:ring-2 placeholder:text-muted-foreground text-center border border-input rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {isSaving && <span className="animate-pulse">●</span>}
              {!isSaving && lastSaved && (
                <span>Sauvé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            <Badge
              variant={page.status === 'published' ? 'default' : 'secondary'}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleTogglePublish}
              title={`Cliquer pour ${page.status === 'published' ? 'dépublier' : 'publier'}`}
            >
              {page.status === 'published' ? 'Publié' : 'Brouillon'}
            </Badge>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
            >
              ⚙️ Paramètres
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <PageEditor initialBlocks={page.blocks || []} onSave={handleSaveBlocks} onQuit={handleQuit} />
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-7xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Paramètres de la page</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">URL, SEO et partage social.</p>

          <div className="grid grid-cols-2 gap-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-4">
            {/* Left Column - Content */}
            <div className="space-y-6 border-r pr-6">
              <div>
                <h3 className="font-semibold text-sm mb-4">Contenu</h3>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Meta Title</label>
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        placeholder="Titre pour SEO"
                        maxLength={60}
                        className="h-9 flex-1"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {metaTitle.length}/60
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Meta Description</label>
                    <div className="flex items-start justify-between gap-2">
                      <textarea
                        value={metaDesc}
                        onChange={(e) => setMetaDesc(e.target.value)}
                        placeholder="Description pour SEO"
                        maxLength={160}
                        className="h-20 flex-1 rounded border border-input px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {metaDesc.length}/160
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">OG Image</label>
                    <Input
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      placeholder="https://exemple.com/image.jpg"
                      type="url"
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      Image de partage • 1200×630px
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-6 pl-6">
              <div>
                <h3 className="font-semibold text-sm mb-4">Aperçu</h3>

                {/* Google Preview */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Google</p>
                  <div className="border rounded p-3 bg-gray-50 space-y-1">
                    <p className="text-sm text-muted-foreground">{slug ? `votredomaine.com/${slug}` : 'votredomaine.com'}</p>
                    <p className="text-sm font-medium text-blue-600 line-clamp-1">
                      {metaTitle || 'Titre pour SEO'}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {metaDesc || 'Description pour SEO'}
                    </p>
                  </div>
                </div>

                {/* Social Preview */}
                <div className="space-y-3 mt-4">
                  <p className="text-xs font-medium text-muted-foreground">Social</p>
                  <div className="border rounded overflow-hidden bg-white">
                    {ogImage && (
                      <img
                        src={ogImage}
                        alt="OG Preview"
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    {!ogImage && (
                      <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4.5-4.5 3 3 4.5-4.5V15z" />
                        </svg>
                      </div>
                    )}
                    <div className="p-3 space-y-1">
                      <p className="text-sm font-medium line-clamp-1">
                        {metaTitle || 'Titre pour SEO'}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-1">
                        {metaDesc || 'Description pour SEO'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {slug ? `votredomaine.com/${slug}` : 'votredomaine.com'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
