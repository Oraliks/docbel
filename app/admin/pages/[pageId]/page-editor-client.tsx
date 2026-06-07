'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import type { BlockProps, PageVariable, ThemeTokens } from '@/lib/page-builder/types'

const Editor = dynamic(
  () => import('@/components/page-builder/editor').then((m) => ({ default: m.Editor })),
  { ssr: false, loading: () => <div className="flex-1 p-8 text-sm text-muted-foreground">Chargement de l&apos;éditeur…</div> }
)
const Topbar = dynamic(
  () => import('@/components/page-builder/topbar').then((m) => ({ default: m.Topbar })),
  { ssr: false }
)
const VersionsDialog = dynamic(
  () => import('@/components/page-builder/versions-dialog').then((m) => ({ default: m.VersionsDialog })),
  { ssr: false }
)
const ThemeDialog = dynamic(
  () => import('@/components/page-builder/theme-dialog').then((m) => ({ default: m.ThemeDialog })),
  { ssr: false }
)
const VariablesDialog = dynamic(
  () => import('@/components/page-builder/variables-dialog').then((m) => ({ default: m.VariablesDialog })),
  { ssr: false }
)

interface PageEditorPageProps {
  params: Promise<{ pageId: string }>
}

const AUTOSAVE_DELAY_MS = 1500

const META_TEXT_KEYS = [
  'text', 'html', 'title', 'subtitle', 'description', 'content', 'quote',
  'caption', 'answer', 'question',
]
/** Flatten a page's blocks to plain text for the AI meta generator. */
function extractBlocksText(blocks: BlockProps[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    const p = b.props as Record<string, unknown>
    for (const k of META_TEXT_KEYS) {
      const v = p[k]
      if (typeof v === 'string' && v.trim()) parts.push(v)
    }
  }
  return parts
    .join('\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** ISO string → value for <input type="datetime-local"> (local time, no tz). */
function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PageEditorClient({ params }: PageEditorPageProps) {
  const router = useRouter()

  const page = usePageBuilderStore((s) => s.page)
  const blocks = usePageBuilderStore((s) => s.blocks)
  const isDirty = usePageBuilderStore((s) => s.isDirty)
  const setPage = usePageBuilderStore((s) => s.setPage)
  const setBlocks = usePageBuilderStore((s) => s.setBlocks)
  const setIsDirty = usePageBuilderStore((s) => s.setIsDirty)
  const togglePreviewMode = usePageBuilderStore((s) => s.togglePreviewMode)
  const reset = usePageBuilderStore((s) => s.reset)

  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDesc, setMetaDesc] = useState('')
  const [ogImage, setOgImage] = useState('')
  const [aiMetaLoading, setAiMetaLoading] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showVersionsDialog, setShowVersionsDialog] = useState(false)
  const [showThemeDialog, setShowThemeDialog] = useState(false)
  const [showVariablesDialog, setShowVariablesDialog] = useState(false)
  const themeTokens = usePageBuilderStore((s) => s.themeTokens)
  const setThemeTokens = usePageBuilderStore((s) => s.setThemeTokens)
  const variables = usePageBuilderStore((s) => s.variables)
  const setVariables = usePageBuilderStore((s) => s.setVariables)

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingPayloadRef = useRef<Record<string, unknown>>({})
  const inflightRef = useRef<AbortController | null>(null)
  const initialBlocksRef = useRef<BlockProps[]>([])
  const lastSavedBlocksRef = useRef<BlockProps[] | null>(null)
  const lastSavedThemeRef = useRef<ThemeTokens | null>(null)
  const lastSavedVarsRef = useRef<PageVariable[] | null>(null)
  const initialMountRef = useRef(true)
  // Stable ref so the persist callback below doesn't depend on `page` (which
  // would re-create persist on every save and re-trigger the autosave effect).
  const pageIdRef = useRef<string | null>(null)

  const fetchPage = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/pages/${id}`)
        if (!res.ok) throw new Error('Page not found')
        const data = await res.json()

        setPage(data)
        pageIdRef.current = data.id
        const initialBlocks: BlockProps[] = data.blocks || []
        initialBlocksRef.current = initialBlocks
        lastSavedBlocksRef.current = initialBlocks
        setBlocks(initialBlocks, { skipHistory: true })
        setTitle(data.title)
        setSlug(data.slug)
        setMetaTitle(data.metaTitle || '')
        setMetaDesc(data.metaDesc || '')
        setOgImage(data.ogImage || '')
        setScheduledAt(isoToDatetimeLocal(data.scheduledAt))
        setThemeTokens(data.themeTokens ?? null)
        lastSavedThemeRef.current = data.themeTokens ?? null
        const loadedVars: PageVariable[] = Array.isArray(data.variables)
          ? data.variables
          : []
        setVariables(loadedVars)
        lastSavedVarsRef.current = loadedVars
        setLastSaved(new Date())
        setIsDirty(false)
      } catch (error) {
        console.error('Failed to fetch page:', error)
        toast.error('Impossible de charger la page')
        router.push('/admin/pages')
      } finally {
        setLoading(false)
      }
    },
    [router, setBlocks, setIsDirty, setPage, setThemeTokens, setVariables]
  )

  useEffect(() => {
    void (async () => {
      const { pageId } = await params
      await fetchPage(pageId)
    })()
  }, [fetchPage, params])

  // Reset the store ONLY when the editor unmounts. Putting `reset` in the
  // fetch effect cleanup wipes blocks on every re-run, which races with the
  // autosave watcher and persists `content: []` to the database.
  useEffect(() => {
    return () => {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback(
    async (payload: Record<string, unknown>) => {
      const id = pageIdRef.current
      if (!id) return null
      inflightRef.current?.abort()
      const ctrl = new AbortController()
      inflightRef.current = ctrl

      // Snapshot what we're saving so we can mark blocks as "saved" after success.
      const savedBlocks =
        'content' in payload ? (payload.content as BlockProps[]) : null

      setIsSaving(true)
      try {
        const res = await fetch(`/api/pages/${id}`, {
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
        // setPage updates the metadata in the store (status, slug, updatedAt…)
        // but does NOT touch the `blocks` array, so it won't re-trigger autosave.
        setPage(updated)
        if (savedBlocks) lastSavedBlocksRef.current = savedBlocks
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
    [setIsDirty, setPage]
  )

  const scheduleAutosave = useCallback(
    (payload: Record<string, unknown>) => {
      setIsDirty(true)
      pendingPayloadRef.current = { ...pendingPayloadRef.current, ...payload }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        const merged = pendingPayloadRef.current
        pendingPayloadRef.current = {}
        void persist(merged)
      }, AUTOSAVE_DELAY_MS)
    },
    [persist, setIsDirty]
  )

  // Autosave when blocks change. We deliberately drop `page` from the deps:
  // setPage() after each save would otherwise re-trigger this effect and loop.
  useEffect(() => {
    if (!pageIdRef.current) return
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    // Skip if blocks haven't actually changed since last save (prevents
    // duplicate saves when the store re-emits the same array).
    if (blocks === lastSavedBlocksRef.current) return
    scheduleAutosave({ content: blocks })
  }, [blocks, scheduleAutosave])

  // Autosave the per-page theme when it changes. Compare against the last
  // loaded/saved value (mirrors the blocks watcher) so we never re-save the
  // theme we just loaded — and, crucially, so the FIRST real change on a
  // theme-less page isn't swallowed by a one-shot guard.
  useEffect(() => {
    if (!pageIdRef.current) return
    if (themeTokens === lastSavedThemeRef.current) return
    lastSavedThemeRef.current = themeTokens
    scheduleAutosave({ themeTokens })
  }, [themeTokens, scheduleAutosave])

  // Autosave page variables when they change (mirrors the theme watcher).
  // Only well-formed keys are persisted, so a half-typed row never 400s the
  // whole patch.
  useEffect(() => {
    if (!pageIdRef.current) return
    if (variables === lastSavedVarsRef.current) return
    lastSavedVarsRef.current = variables
    scheduleAutosave({
      variables: variables.filter((v) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(v.key)),
    })
  }, [variables, scheduleAutosave])

  // ⌘S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        void persist({ title, content: blocks })
        toast.success('Sauvegardé')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocks, persist, title])

  // beforeunload guard
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

  const handleTitleChange = (next: string) => {
    setTitle(next)
    scheduleAutosave({ title: next })
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
        toast.success(newStatus === 'published' ? 'Page publiée 🚀' : 'Remise en brouillon')
      } else {
        toast.error('Erreur lors du changement d’état')
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error)
      toast.error('Erreur lors du changement d’état')
    } finally {
      setIsSaving(false)
    }
  }, [page, setPage])

  const handleSaveSettings = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    const cleanSlug = slugify(slug.startsWith('/') ? slug.slice(1) : slug)
    if (!cleanSlug) {
      toast.error('Slug invalide')
      return
    }
    // Schedule publication when a FUTURE date is set. A past/empty date clears
    // the schedule (scheduledAt: null) and leaves the current status untouched.
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null
    const isFutureSchedule =
      scheduledDate !== null &&
      !Number.isNaN(scheduledDate.getTime()) &&
      scheduledDate.getTime() > Date.now()

    const payload: Record<string, unknown> = {
      title,
      slug: cleanSlug,
      metaTitle: metaTitle || null,
      metaDesc: metaDesc || null,
      ogImage: ogImage || null,
      scheduledAt: isFutureSchedule ? scheduledDate!.toISOString() : null,
    }
    if (isFutureSchedule) payload.status = 'scheduled'

    const result = await persist(payload)
    if (!result) return
    setSlug(cleanSlug)
    if (isFutureSchedule) {
      toast.success(
        `Publication planifiée le ${scheduledDate!.toLocaleString('fr-FR', {
          dateStyle: 'long',
          timeStyle: 'short',
        })}`
      )
    } else {
      toast.success('Paramètres sauvegardés')
    }
    setShowSettingsDialog(false)
  }

  const saveLabel = useMemo(() => {
    if (isSaving) return 'Enregistrement…'
    if (isDirty) return 'Modifications non sauvegardées'
    if (lastSaved)
      return `Sauvé à ${lastSaved.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    return 'Nouvelle page'
  }, [isSaving, isDirty, lastSaved])

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="border-b bg-card p-3">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <Skeleton className="w-60 border-r" />
          <div className="flex-1 p-8 space-y-3">
            <Skeleton className="h-24 w-full max-w-3xl mx-auto" />
            <Skeleton className="h-32 w-full max-w-3xl mx-auto" />
            <Skeleton className="h-24 w-full max-w-3xl mx-auto" />
          </div>
          <Skeleton className="w-[340px] border-l" />
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

  const handleExport = () => {
    const data = {
      _type: 'beldoc-page',
      _version: 1,
      title,
      slug,
      metaTitle: metaTitle || null,
      metaDesc: metaDesc || null,
      ogImage: ogImage || null,
      themeTokens: themeTokens ?? null,
      variables,
      blocks,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug || 'page'}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Page exportée en JSON')
  }

  const handleAiMeta = async () => {
    const content = extractBlocksText(blocks)
    if (!content) {
      toast.error('Ajoutez du contenu à la page d’abord')
      return
    }
    setAiMetaLoading(true)
    try {
      const res = await fetch('/api/page-builder/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'meta', text: content }),
      })
      const data = await res.json()
      if (data?.aiDisabled) {
        toast.error('Assistant IA non configuré')
        return
      }
      if (!res.ok || data?.error) {
        toast.error(data?.error || 'Échec de la génération')
        return
      }
      if (data.title) setMetaTitle(String(data.title).slice(0, 60))
      if (data.desc) setMetaDesc(String(data.desc).slice(0, 160))
      toast.success('Métadonnées générées')
    } catch {
      toast.error('Échec de la génération')
    } finally {
      setAiMetaLoading(false)
    }
  }

  const isPublished = page.status === 'published'

  return (
    <div className="flex h-screen flex-col bg-background">
      <Topbar
        title={title}
        slug={slug}
        saveLabel={saveLabel}
        isPublished={isPublished}
        isSaving={isSaving}
        isDirty={isDirty}
        onBack={() => router.push('/admin/pages')}
        onTitleChange={handleTitleChange}
        onTogglePreview={togglePreviewMode}
        onOpenSettings={() => setShowSettingsDialog(true)}
        onOpenVersions={() => setShowVersionsDialog(true)}
        onOpenTheme={() => setShowThemeDialog(true)}
        onOpenVariables={() => setShowVariablesDialog(true)}
        onExport={handleExport}
        onTogglePublish={handleTogglePublish}
      />

      <Editor />

      <VersionsDialog
        open={showVersionsDialog}
        onOpenChange={setShowVersionsDialog}
        pageId={page.id}
        onRestore={({ title: restoredTitle, blocks: restoredBlocks }) => {
          setTitle(restoredTitle)
          setBlocks(restoredBlocks)
          // Trigger save immediately so the restoration is persisted as a new revision
          void persist({ title: restoredTitle, content: restoredBlocks })
        }}
      />

      <ThemeDialog open={showThemeDialog} onOpenChange={setShowThemeDialog} />

      <VariablesDialog
        open={showVariablesDialog}
        onOpenChange={setShowVariablesDialog}
      />

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paramètres de la page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Slug (URL)</label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="mon-slug"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                URL : /{slugify(slug) || '…'}
                {slug && slugify(slug) !== slug && (
                  <span className="ml-2 italic">(normalisé à la sauvegarde)</span>
                )}
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAiMeta}
                disabled={aiMetaLoading}
              >
                <Sparkles className="mr-1.5 size-3.5" />
                {aiMetaLoading ? 'Génération…' : 'Générer titre + description (IA)'}
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meta title (SEO)</label>
              <div className="relative">
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={60}
                  placeholder="Titre pour les moteurs de recherche"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {metaTitle.length}/60
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Meta description (SEO)</label>
              <div className="relative">
                <textarea
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder="Description pour les résultats de recherche"
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
                <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground bg-card px-1">
                  {metaDesc.length}/160
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Image de partage (OG image)</label>
              <Input
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
              />
              <p className="text-xs text-muted-foreground">Recommandé : 1200×630 px</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Planifier la publication</label>
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="font-mono"
                />
                {scheduledAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScheduledAt('')}
                    title="Effacer la planification"
                  >
                    Effacer
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Une date future planifie la mise en ligne automatique. Laissez vide pour publier manuellement.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
