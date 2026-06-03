'use client'

import React from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus, Loader2, ClipboardPaste, Undo2, Redo2 } from 'lucide-react'
import { BlockWrapper } from './block-wrapper'
import { ThemeProvider } from './theme-tokens'
import { GlobalBlocksProvider } from '@/components/page-builder/global-blocks-context'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { usePageBuilderStore, getRootBlocks } from '@/lib/page-builder/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { BlockProps } from '@/lib/page-builder/types'
import { nanoid } from 'nanoid'

const DEVICE_WIDTH: Record<'desktop' | 'tablet' | 'mobile', number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
}

export function Canvas() {
  const blocks = usePageBuilderStore((s) => s.blocks)
  const device = usePageBuilderStore((s) => s.device)
  const themeTokens = usePageBuilderStore((s) => s.themeTokens)
  const reorderBlocks = usePageBuilderStore((s) => s.reorderBlocks)
  const moveToContainer = usePageBuilderStore((s) => s.moveToContainer)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)
  const insertBlock = usePageBuilderStore((s) => s.insertBlock)
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const pasteBlock = usePageBuilderStore((s) => s.pasteBlock)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const canUndo = usePageBuilderStore((s) => s.past.length > 0)
  const canRedo = usePageBuilderStore((s) => s.future.length > 0)
  const hasClipboard = usePageBuilderStore((s) => s.clipboard !== null)
  const globalBlocks = usePageBuilderStore((s) => s.globalBlocks)
  const setGlobalBlocks = usePageBuilderStore((s) => s.setGlobalBlocks)

  // Charge une fois la liste des blocs globaux → map id→contenu pour que les
  // `globalRef` se résolvent dans le canvas via GlobalBlocksProvider.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/page-builder/global-blocks')
        if (!res.ok) return
        const data = await res.json()
        const items: Array<{ id: string; block: BlockProps }> = data.items ?? []
        if (cancelled) return
        setGlobalBlocks(Object.fromEntries(items.map((g) => [g.id, g.block])))
      } catch {
        // Non-bloquant : un échec de chargement ne doit pas casser l'éditeur.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setGlobalBlocks])

  const rootBlocks = React.useMemo(() => getRootBlocks(blocks), [blocks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const overId = String(over.id)
    // Drop on an (empty) container slot → id shaped `drop:<parentId>:<slot|null>`.
    if (overId.startsWith('drop:')) {
      const rest = overId.slice(5)
      const sep = rest.lastIndexOf(':')
      const parentId = rest.slice(0, sep)
      const slotRaw = rest.slice(sep + 1)
      const slot = slotRaw === 'null' ? null : Number(slotRaw)
      moveToContainer(
        String(active.id),
        parentId,
        Number.isNaN(slot as number) ? null : slot
      )
      return
    }
    reorderBlocks(String(active.id), overId)
  }

  // Drop image / video files directly onto the canvas → auto-insert a block
  const [dragOver, setDragOver] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) {
      toast.error('Seuls les images et vidéos sont supportés')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('isPrivate', 'false')
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Erreur lors du téléchargement')
        return
      }
      const data = await res.json()
      const block: BlockProps = isImage
        ? {
            id: nanoid(),
            type: 'image',
            props: {
              url: `/api/files/${data.id}/download`,
              alt: file.name,
              caption: '',
              ratio: 'auto',
              fit: 'cover',
              rounded: 'md',
            },
          }
        : {
            id: nanoid(),
            type: 'video',
            props: {
              url: '',
              fileId: data.id,
              provider: 'mp4',
              caption: '',
              autoplay: false,
              controls: true,
            },
          }
      insertBlock(block)
      toast.success(isImage ? 'Image ajoutée' : 'Vidéo ajoutée')
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors du téléchargement')
    } finally {
      setUploading(false)
    }
  }

  const isDesktop = device === 'desktop'
  const targetWidth = DEVICE_WIDTH[device]

  return (
    <div
      className="flex-1 overflow-auto bg-muted/30 relative"
      onClick={() => selectBlock(null)}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault()
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={handleFileDrop}
    >
      {(dragOver || uploading) && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-4">
          <div className="bg-card shadow-xl rounded-2xl px-6 py-4 flex items-center gap-3 text-sm font-medium">
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Plus className="size-5 text-primary" />
            )}
            {uploading ? 'Téléchargement…' : 'Déposer pour insérer un bloc image/vidéo'}
          </div>
        </div>
      )}
      <div className="min-h-full flex justify-center py-8 px-4 md:px-12">
        <div
          className={cn(
            'transition-all duration-300 ease-out',
            !isDesktop && 'shadow-2xl rounded-2xl border bg-background overflow-hidden'
          )}
          style={{
            width: '100%',
            maxWidth: isDesktop ? undefined : `${targetWidth}px`,
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <ContextMenu>
              <ContextMenuTrigger>
              <div
                className={cn(
                  'min-h-[calc(100vh-12rem)] bg-background',
                  isDesktop && 'rounded-2xl border shadow-sm overflow-hidden',
                  rootBlocks.length === 0 && 'flex items-center justify-center'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {rootBlocks.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => openPicker()}
                    className="group/empty mx-auto flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/50 px-8 py-16 transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover/empty:bg-primary group-hover/empty:text-primary-foreground">
                      <Plus className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium">Page vide</div>
                      <div className="text-sm text-muted-foreground">
                        Ajoutez un premier bloc · ⌘/
                      </div>
                    </div>
                  </button>
                ) : (
                  <ThemeProvider tokens={themeTokens}>
                    <GlobalBlocksProvider value={globalBlocks}>
                      {/* Top padding leaves room for the first block's hover toolbar
                         (which sits at -top-7 = -28px outside the wrapper). */}
                      <div className="pt-10 pb-3 space-y-6">
                        {rootBlocks.map((block, idx) => (
                          <div key={block.id} className="px-3">
                            <BlockWrapper
                              block={block}
                              siblingIndex={idx}
                              siblingCount={rootBlocks.length}
                            />
                          </div>
                        ))}
                      </div>
                    </GlobalBlocksProvider>
                  </ThemeProvider>
                )}
              </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={() => openPicker()}>
                  <Plus />
                  Ajouter un bloc
                  <ContextMenuShortcut>⌘/</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!hasClipboard} onClick={() => pasteBlock()}>
                  <ClipboardPaste />
                  Coller
                  <ContextMenuShortcut>⌘V</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem disabled={!canUndo} onClick={() => undo()}>
                  <Undo2 />
                  Annuler
                  <ContextMenuShortcut>⌘Z</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!canRedo} onClick={() => redo()}>
                  <Redo2 />
                  Rétablir
                  <ContextMenuShortcut>⌘⇧Z</ContextMenuShortcut>
                </ContextMenuItem>
              </ContextMenuContent>
              </ContextMenu>
            </SortableContext>
          </DndContext>

          {/* Bottom add zone */}
          {rootBlocks.length > 0 && (
            <div className="px-3 py-6 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  openPicker()
                }}
                className="inline-flex items-center gap-2 rounded-full border border-dashed bg-background/80 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary hover:text-primary hover:bg-primary/5"
              >
                <Plus className="size-4" />
                Ajouter un bloc
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
