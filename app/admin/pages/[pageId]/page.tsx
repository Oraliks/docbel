'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Globe, Redo2, Settings2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageEditor } from '@/components/page-builder/page-editor'
import { BlockProps } from '@/lib/page-builder/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface PageEditorPageProps {
  params: Promise<{
    pageId: string
  }>
}

const AUTOSAVE_DELAY_MS = 800

export default function PageEditorPage({ params }: PageEditorPageProps) {
  const router = useRouter()
  const page = usePageBuilderStore((s) => s.page)
  const blocks = usePageBuilderStore((s) => s.blocks)
  const isDirty = usePageBuilderStore((s) => s.isDirty)
  const past = usePageBuilderStore((s) => s.past)
  const future = usePageBuilderStore((s) => s.future)
  const setPage = usePageBuilderStore((s) => s.setPage)
  const setBlocks = usePageBuilderStore((s) => s.setBlocks)
  const setIsDirty = usePageBuilderStore((s) => s.setIsDirty)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const reset = usePageBuilderStore((s) => s.reset)

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [ogImage, setOgImage] = useState('')

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inflightRef = useRef<AbortController | null>(null)
  const initialBlocksRef = useRef<BlockProps[]>([])
  const initialMountRef = useRef(true)

  const fetchPage = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/pages/${id}`)
      if (!res.ok) throw new Error('Page not found')

      const data = await res.json()
      setPage(data)
      const initialBlocks: BlockProps[] = data.blocks || []
      initialBlocksRef.current = initialBlocks
      setBlocks(initialBlocks, { skipHistory: true })
      setTitle(data.title)
      setSlug(data.slug)
      setMetaTitle(data.metaTitle || '')
      setMetaDesc(data.metaDesc || '')
      setOgImage(data.ogImage || '')
      setLastSaved(new Date())
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to fetch page:', error)
      toast.error('Impossible de charger la page')
      router.push('/admin/pages')
    } finally {
      setLoading(false)
    }
  }, [router, setBlocks, setIsDirty, setPage])

  useEffect(() => {
    const initializePageId = async () => {
      const { pageId } = await params
      await fetchPage(pageId)
    }
    void initializePageId()
    return () => {
      reset()
    }
  }, [fetchPage, params, reset])

  const persist = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!page) return null
      inflightRef.current?.abort()
      const ctrl = new AbortController()
      inflightRef.current = ctrl

      setIsSaving(true)
      try {
        const res = await fetch(`/api/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        })
        if (!res.ok) {
          let msg = 'Erreur lors de la sauvegarde'
          try {
            const err = await res.json()
            msg = err.error || msg
          } catch {}
          toast.error(msg)
          return null
        }
        const updated = await res.json()
        setPage(updated)
        setLastSaved(new Date())
        setIsDirty(false)
        return updated
      } catch (error) {
        if ((error as Error).name === 'AbortError') return null
        console.error('Failed to save:', error)
        toast.error('Erreur lors de la sauvegarde')
        return null
      } finally {
        if (inflightRef.current === ctrl) {
          setIsSaving(false)
          inflightRef.current = null
        }
      }
    },
    [page, setIsDirty, setPage]
  )

  const scheduleAutosave = useCallback(
    (payload: Record<string, unknown>) => {
      setIsDirty(true)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        void persist(payload)
      }, AUTOSAVE_DELAY_MS)
    },
    [persist, setIsDirty]
  )

  // Autosave when blocks change (skip first render after fetch)
  useEffect(() => {
    if (!page) return
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    if (blocks === initialBlocksRef.current) return
    scheduleAutosave({ content: blocks })
  }, [blocks, page, scheduleAutosave])

  // beforeunload guard while dirty / saving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty || isSaving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, isSaving])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const editing =
        tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      const meta = e.ctrlKey || e.metaKey

      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (editing) return
        e.preventDefault()
        undo()
      } else if (
        (meta && e.key.toLowerCase() === 'y') ||
        (meta && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (editing) return
        e.preventDefault()
        redo()
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        void persist({ title, content: blocks })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocks, persist, redo, title, undo])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    scheduleAutosave({ title: newTitle })
  }

  const handleSlugChange = (newSlug: string) => {
    const cleanSlug = newSlug.startsWith('/') ? newSlug.slice(1) : newSlug
    setSlug(cleanSlug)
    scheduleAutosave({ slug: cleanSlug })
  }

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
        toast.success(newStatus === 'published' ? 'Page publiée' : 'Page remise en brouillon')
      } else {
        toast.error("Erreur lors du changement d'état")
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      toast.error("Erreur lors du changement d'état")
    } finally {
      setIsSaving(false)
    }
  }, [page, setPage])

  const handleSaveSettings = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    await persist({
      title,
      slug,
      metaTitle: metaTitle || null,
      metaDesc: metaDesc || null,
      ogImage: ogImage || null,
    })
    toast.success('Paramètres sauvegardés')
    setShowSettingsDialog(false)
  }

  const saveLabel = useMemo(() => {
    if (isSaving) return 'Enregistrement...'
    if (isDirty) return 'Modifications non sauvegardées'
    if (lastSaved)
      return `Sauvé à ${lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    return 'Nouvelle page'
  }, [isSaving, isDirty, lastSaved])

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="border-b bg-card">
          <div className="flex items-center justify-between gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex max-w-2xl flex-1 flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-8 w-2/3 rounded-lg" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-8 w-28 rounded" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Page non trouvée</p>
      </div>
    )
  }

  const isPublished = page.status === 'published'

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="border-b bg-card">
        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-start xl:justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/pages')}
            className="self-start"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-3 xl:max-w-2xl xl:items-center">
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titre de la page"
              className="h-10 w-full rounded-lg border border-input px-3 py-1 text-left text-2xl font-bold shadow-none placeholder:text-muted-foreground focus-visible:ring-2 xl:text-center"
            />
            <Input
              value={`/${slug}`}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="/mon-slug"
              className="h-9 w-full rounded-lg border border-input px-3 py-1 text-left text-sm shadow-none placeholder:text-muted-foreground focus-visible:ring-2 xl:text-center"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
                {saveLabel}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground">
                <Globe className="mr-1 inline h-3.5 w-3.5" />
                {slug ? `/${slug}` : 'Slug à définir'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button
              size="icon"
              variant="ghost"
              onClick={undo}
              disabled={past.length === 0}
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={redo}
              disabled={future.length === 0}
              title="Rétablir (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            <Badge variant={isPublished ? 'default' : 'secondary'} className="px-3 py-1">
              {isPublished ? 'Publiée' : 'Brouillon'}
            </Badge>

            <Button size="sm" variant="outline" onClick={() => setShowSettingsDialog(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Paramètres
            </Button>

            <Button size="sm" variant={isPublished ? 'outline' : 'default'} onClick={handleTogglePublish}>
              {isPublished ? 'Remettre en brouillon' : 'Publier'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PageEditor initialBlocks={page.blocks || []} />
      </div>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-7xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Paramètres de la page</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">URL, SEO et partage social.</p>

          <div className="grid max-h-[calc(100vh-200px)] grid-cols-1 gap-6 overflow-y-auto pr-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-6 xl:border-r xl:pr-6">
              <div>
                <h3 className="mb-4 text-sm font-semibold">Contenu</h3>

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
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
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
                        className="h-20 flex-1 resize-none rounded border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
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
                      Image de partage • 1200×630 px
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 xl:pl-6">
              <div>
                <h3 className="mb-4 text-sm font-semibold">Aperçu</h3>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Google</p>
                  <div className="space-y-1 rounded border bg-muted/50 p-3">
                    <p className="text-sm text-muted-foreground">{slug ? `votredomaine.com/${slug}` : 'votredomaine.com'}</p>
                    <p className="line-clamp-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {metaTitle || 'Titre pour SEO'}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {metaDesc || 'Description pour SEO'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Social</p>
                  <div className="overflow-hidden rounded border bg-card">
                    {ogImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ogImage}
                        alt="OG Preview"
                        className="h-32 w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    {!ogImage && (
                      <div className="flex h-32 w-full items-center justify-center bg-muted">
                        <svg className="h-8 w-8 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4.5-4.5 3 3 4.5-4.5V15z" />
                        </svg>
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-1 text-sm font-medium">
                        {metaTitle || 'Titre pour SEO'}
                      </p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {metaDesc || 'Description pour SEO'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {slug ? `votredomaine.com/${slug}` : 'votredomaine.com'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
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
