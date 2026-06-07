'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  GripVertical,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ClipboardCopy,
  Scissors,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Group,
  ClipboardPaste,
  Undo2,
  Redo2,
  BookmarkPlus,
  Boxes,
  Box,
  Columns3,
  RectangleHorizontal,
  Palette,
  Brush,
  Ungroup,
} from 'lucide-react'
import type { BlockProps } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/registry'
import { childLayoutClass, type ChildLayout } from '@/components/page-blocks/layout/container-layout'
import { saveSnippet } from '@/lib/page-builder/snippets'
import {
  listStylePresets,
  saveStylePreset,
  type StylePreset,
} from '@/lib/page-builder/style-presets'
import { BlockRenderer } from './block-renderer'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { usePageBuilderStore, getChildrenOf } from '@/lib/page-builder/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BlockWrapperProps {
  block: BlockProps
  /** Index among siblings (top-level or within a slot). Used to enable/disable move buttons. */
  siblingIndex: number
  siblingCount: number
}

/** Les conteneurs ne sont pas convertibles en bloc global (un globalRef ne porte pas d'enfants). */
function isContainerType(type: string): boolean {
  return type === 'section' || type === 'container' || type === 'columns' || type === 'repeater'
}

export function BlockWrapper({ block, siblingIndex, siblingCount }: BlockWrapperProps) {
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId)
  const selectedIds = usePageBuilderStore((s) => s.selectedIds)
  const hoveredBlockId = usePageBuilderStore((s) => s.hoveredBlockId)
  const device = usePageBuilderStore((s) => s.device)
  const allBlocks = usePageBuilderStore((s) => s.blocks)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)
  const toggleSelection = usePageBuilderStore((s) => s.toggleSelection)
  const hoverBlock = usePageBuilderStore((s) => s.hoverBlock)
  const removeBlock = usePageBuilderStore((s) => s.removeBlock)
  const duplicateBlock = usePageBuilderStore((s) => s.duplicateBlock)
  const moveBlock = usePageBuilderStore((s) => s.moveBlock)
  const copyBlock = usePageBuilderStore((s) => s.copyBlock)
  const cutBlock = usePageBuilderStore((s) => s.cutBlock)
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const updateBlockMeta = usePageBuilderStore((s) => s.updateBlockMeta)
  const wrapInContainer = usePageBuilderStore((s) => s.wrapInContainer)
  const moveToContainer = usePageBuilderStore((s) => s.moveToContainer)
  const removeMany = usePageBuilderStore((s) => s.removeMany)
  const pasteBlock = usePageBuilderStore((s) => s.pasteBlock)
  const undo = usePageBuilderStore((s) => s.undo)
  const redo = usePageBuilderStore((s) => s.redo)
  const canUndo = usePageBuilderStore((s) => s.past.length > 0)
  const canRedo = usePageBuilderStore((s) => s.future.length > 0)
  const hasClipboard = usePageBuilderStore((s) => s.clipboard !== null)
  const globalBlocks = usePageBuilderStore((s) => s.globalBlocks)
  const setGlobalBlocks = usePageBuilderStore((s) => s.setGlobalBlocks)
  const replaceBlock = usePageBuilderStore((s) => s.replaceBlock)
  const updateBlockLayoutLive = usePageBuilderStore((s) => s.updateBlockLayoutLive)
  const pushHistoryCheckpoint = usePageBuilderStore((s) => s.pushHistoryCheckpoint)
  const copyBlockStyle = usePageBuilderStore((s) => s.copyBlockStyle)
  const pasteBlockStyle = usePageBuilderStore((s) => s.pasteBlockStyle)
  const applyStyle = usePageBuilderStore((s) => s.applyStyle)
  const hasStyleClipboard = usePageBuilderStore((s) => s.styleClipboard !== null)
  const [stylePresets, setStylePresets] = React.useState<StylePreset[]>(() =>
    listStylePresets()
  )

  // ── "Save as snippet" dialog ──
  const [snippetDialogOpen, setSnippetDialogOpen] = React.useState(false)
  const [snippetName, setSnippetName] = React.useState('')
  const [snippetDescription, setSnippetDescription] = React.useState('')
  const [savingSnippet, setSavingSnippet] = React.useState(false)

  const openSnippetDialog = React.useCallback(() => {
    setSnippetName(BLOCK_REGISTRY[block.type]?.name ?? '')
    setSnippetDescription('')
    setSnippetDialogOpen(true)
  }, [block.type])

  const handleSaveSnippet = React.useCallback(async () => {
    const name = snippetName.trim()
    if (!name) {
      toast.error('Un nom est requis')
      return
    }
    setSavingSnippet(true)
    try {
      await saveSnippet(name, block, snippetDescription.trim() || undefined)
      toast.success('Snippet enregistré')
      setSnippetDialogOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement")
    } finally {
      setSavingSnippet(false)
    }
  }, [snippetName, snippetDescription, block])

  // ── "Convertir en bloc global" ──
  // Persiste le bloc comme GlobalBlock, l'ajoute à la map (résolution immédiate)
  // puis remplace le bloc courant par un `globalRef` pointant dessus.
  const [converting, setConverting] = React.useState(false)

  const handleConvertToGlobal = React.useCallback(async () => {
    if (converting) return
    setConverting(true)
    try {
      const res = await fetch('/api/page-builder/global-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: BLOCK_REGISTRY[block.type]?.name ?? block.type,
          block,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Échec de la conversion')
      }
      const { id } = (await res.json()) as { id: string }
      // Ajoute au map pour que le globalRef se résolve immédiatement.
      setGlobalBlocks({ ...globalBlocks, [id]: block })
      replaceBlock(block.id, {
        id: block.id,
        type: 'globalRef',
        props: { globalBlockId: id },
      })
      toast.success('Converti en bloc global')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Échec de la conversion')
    } finally {
      setConverting(false)
    }
  }, [converting, block, globalBlocks, setGlobalBlocks, replaceBlock])

  const canConvertToGlobal = !isContainerType(block.type) && block.type !== 'globalRef'

  const handleSaveStylePreset = React.useCallback(() => {
    const name = window.prompt('Nom du style à enregistrer :')?.trim()
    if (!name) return
    saveStylePreset(name, { style: block.style, layout: block.layout })
    setStylePresets(listStylePresets())
    toast.success('Style enregistré')
  }, [block.style, block.layout])

  const parentBlock = block.parentId
    ? allBlocks.find((b) => b.id === block.parentId)
    : null
  const parentFree = !!(
    parentBlock && (parentBlock.props as { freeLayout?: boolean }).freeLayout
  )
  const freeAbsolute = parentFree && !!block.layout?.absolute && !block.meta?.locked

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: !!block.meta?.locked || freeAbsolute })

  const isSelected = selectedBlockId === block.id
  const isInMultiSelection = selectedIds.includes(block.id) && selectedIds.length > 1
  const isHovered = hoveredBlockId === block.id
  const isFirst = siblingIndex === 0
  const isLast = siblingIndex === siblingCount - 1
  const meta = BLOCK_REGISTRY[block.type]
  const isContainer = isContainerType(block.type)
  const isLocked = !!block.meta?.locked
  const isHidden = !!block.meta?.hidden

  // Envelopper : seuls les blocs de premier niveau (non imbriqués) et déverrouillés.
  const canWrap = !block.parentId && !isLocked
  const wrapIds = isInMultiSelection ? selectedIds : [block.id]
  const wrapLabel = isInMultiSelection
    ? `Envelopper ${selectedIds.length} blocs dans`
    : 'Envelopper dans'
  function handleWrap(type: 'section' | 'container' | 'columns') {
    wrapInContainer(wrapIds, type)
    const names = {
      section: 'une section',
      container: 'un conteneur',
      columns: 'des colonnes',
    }
    toast.success(`Enveloppé dans ${names[type]}`)
  }

  // ── Poignée de redimensionnement (blocs simples, non conteneurs) ──
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const innerRef = React.useRef<HTMLDivElement | null>(null)
  const setWrapperRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      wrapperRef.current = node
    },
    [setNodeRef]
  )
  const canResize = isSelected && !isLocked && !isContainer
  // Non-container blocks are draggable from their whole body (not just the grip).
  const bodyDrag = !isContainer && !isLocked && !freeAbsolute
  const [handleX, setHandleX] = React.useState<number | null>(null)
  const [liveWidthPct, setLiveWidthPct] = React.useState<number | null>(null)
  const resizeStart = React.useRef<{ availPx: number; wrapLeft: number } | null>(null)

  React.useLayoutEffect(() => {
    if (!canResize) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHandleX(null)
      return
    }
    const measure = () => {
      const wrap = wrapperRef.current
      const inner = innerRef.current?.firstElementChild as HTMLElement | null
      if (!wrap || !inner) return
      const wrapRect = wrap.getBoundingClientRect()
      const blockRect = inner.getBoundingClientRect()
      setHandleX(blockRect.right - wrapRect.left)
    }
    measure()
    const wrap = wrapperRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [canResize, block.layout?.width, block.layout?.align, device])

  function onResizePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapperRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    resizeStart.current = { availPx: rect.width, wrapLeft: rect.left }
    pushHistoryCheckpoint()
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  function onResizePointerMove(e: React.PointerEvent) {
    const start = resizeStart.current
    if (!start) return
    let pct = Math.round(((e.clientX - start.wrapLeft) / start.availPx) * 100)
    pct = Math.max(10, Math.min(100, pct))
    for (const snap of [25, 33, 50, 66, 75, 100]) {
      if (Math.abs(pct - snap) <= 2) {
        pct = snap
        break
      }
    }
    setLiveWidthPct(pct)
    updateBlockLayoutLive(block.id, {
      width: pct >= 100 ? '100%' : `${pct}%`,
      align: 'left',
    })
  }
  function onResizePointerUp(e: React.PointerEvent) {
    if (!resizeStart.current) return
    resizeStart.current = null
    setLiveWidthPct(null)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const wrapperStyle: React.CSSProperties = freeAbsolute
    ? {
        position: 'absolute',
        left: block.layout?.left ?? 0,
        top: block.layout?.top ?? 0,
        zIndex: block.layout?.zIndex,
        opacity: isDragging ? 0.4 : 1,
      }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }

  // Build children slots for containers
  let slot: React.ReactNode = null
  let slotByIndex: ((idx: number) => React.ReactNode) | undefined

  if (block.type === 'section' || block.type === 'container') {
    const items = getChildrenOf(allBlocks, block.id)
    slot = (
      <ChildrenList
        parentId={block.id}
        slotIndex={null}
        items={items}
        emptyLabel={block.type === 'section' ? 'Section vide' : 'Conteneur vide'}
        layoutClass={childLayoutClass(block.props as ChildLayout)}
      />
    )
  } else if (block.type === 'repeater') {
    const items = getChildrenOf(allBlocks, block.id)
    slot = (
      <ChildrenList
        parentId={block.id}
        slotIndex={null}
        items={items}
        emptyLabel="Modèle du répéteur — glissez les blocs à répéter ici"
      />
    )
  } else if (block.type === 'columns') {
    slotByIndex = (idx) => {
      const colChildren = getChildrenOf(allBlocks, block.id, idx)
      return (
        <ChildrenList
          parentId={block.id}
          slotIndex={idx}
          items={colChildren}
          emptyLabel={`Colonne ${idx + 1}`}
        />
      )
    }
  }

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger>
    <div
      ref={setWrapperRefs}
      style={wrapperStyle}
      data-block-id={block.id}
      {...(bodyDrag ? listeners : {})}
      onClick={(e) => {
        e.stopPropagation()
        if (e.shiftKey) {
          toggleSelection(block.id)
        } else {
          selectBlock(block.id)
        }
      }}
      onMouseEnter={(e) => {
        e.stopPropagation()
        hoverBlock(block.id)
      }}
      onMouseLeave={() => {
        if (hoveredBlockId === block.id) hoverBlock(null)
      }}
      className={cn(
        'relative group/block transition-all rounded-md',
        isSelected && 'outline-2 outline-primary outline-offset-2 outline',
        isInMultiSelection && !isSelected && 'outline-2 outline-amber-500 outline-offset-2 outline',
        !isSelected && !isInMultiSelection && isHovered && 'outline outline-1 outline-primary/40 outline-offset-2',
        isHidden && 'opacity-40',
        bodyDrag && 'cursor-grab active:cursor-grabbing',
        isLocked && 'cursor-default'
      )}
    >
      {/* Block label tag (top-left) */}
      {(isHovered || isSelected) && (
        <div className="absolute -top-7 left-0 z-20 flex items-center gap-2 pointer-events-none animate-in fade-in-0 slide-in-from-bottom-1 duration-150">
          <div
            className={cn(
              'pointer-events-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium shadow-sm',
              isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-card border'
            )}
            {...(isLocked ? {} : attributes)}
            {...(isLocked || bodyDrag ? {} : listeners)}
            onClick={(e) => e.stopPropagation()}
          >
            {isLocked ? <Lock className="size-3" /> : <GripVertical className="size-3" />}
            {meta.name}
            {isHidden && <EyeOff className="size-3 opacity-70" />}
            {isInMultiSelection && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 leading-tight">
                {selectedIds.length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Right-side toolbar */}
      {(isHovered || isSelected) && (
        <div
          className="absolute -top-7 right-0 z-20 flex items-center gap-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-card shadow-sm"
            disabled={isFirst}
            onClick={() => moveBlock(block.id, 'up')}
            title="Monter"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-card shadow-sm"
            disabled={isLast}
            onClick={() => moveBlock(block.id, 'down')}
            title="Descendre"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-card shadow-sm"
            onClick={() => {
              duplicateBlock(block.id)
              toast.success('Bloc dupliqué')
            }}
            title="Dupliquer (⌘D)"
          >
            <Copy className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7 bg-card shadow-sm"
                  title="Plus d'actions"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => copyBlock(block.id)}>
                <ClipboardCopy className="mr-2 size-4" />
                Copier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  cutBlock(block.id)
                  toast.success('Bloc coupé')
                }}
              >
                <Scissors className="mr-2 size-4" />
                Couper
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openSnippetDialog}>
                <BookmarkPlus className="mr-2 size-4" />
                Enregistrer comme snippet
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  copyBlockStyle(block.id)
                  toast.success('Style copié')
                }}
              >
                <Palette className="mr-2 size-4" />
                Copier le style
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasStyleClipboard}
                onClick={() => {
                  pasteBlockStyle(isInMultiSelection ? selectedIds : [block.id])
                  toast.success('Style appliqué')
                }}
              >
                <Brush className="mr-2 size-4" />
                Coller le style
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="mr-2 size-4" />
                  Styles enregistrés
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={handleSaveStylePreset}>
                    <BookmarkPlus className="mr-2 size-4" />
                    Enregistrer le style actuel…
                  </DropdownMenuItem>
                  {stylePresets.length > 0 ? (
                    <>
                      <DropdownMenuSeparator />
                      {stylePresets.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => {
                            applyStyle(isInMultiSelection ? selectedIds : [block.id], {
                              style: p.style,
                              layout: p.layout,
                            })
                            toast.success(`Style « ${p.name} » appliqué`)
                          }}
                        >
                          <Palette className="mr-2 size-4" />
                          {p.name}
                        </DropdownMenuItem>
                      ))}
                    </>
                  ) : (
                    <DropdownMenuItem disabled>Aucun style enregistré</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {canConvertToGlobal && (
                <DropdownMenuItem disabled={converting} onClick={handleConvertToGlobal}>
                  <Boxes className="mr-2 size-4" />
                  Convertir en bloc global
                </DropdownMenuItem>
              )}
              {block.parentId && (
                <DropdownMenuItem
                  onClick={() => {
                    moveToContainer(block.id, null, null)
                    toast.success('Bloc sorti du conteneur')
                  }}
                >
                  <Ungroup className="mr-2 size-4" />
                  Sortir du conteneur
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  updateBlockMeta(block.id, { locked: !isLocked })
                  toast.success(isLocked ? 'Bloc déverrouillé' : 'Bloc verrouillé')
                }}
              >
                {isLocked ? (
                  <Unlock className="mr-2 size-4" />
                ) : (
                  <Lock className="mr-2 size-4" />
                )}
                {isLocked ? 'Déverrouiller' : 'Verrouiller'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  updateBlockMeta(block.id, { hidden: !isHidden })
                  toast.success(isHidden ? 'Bloc affiché' : 'Bloc masqué')
                }}
              >
                {isHidden ? (
                  <Eye className="mr-2 size-4" />
                ) : (
                  <EyeOff className="mr-2 size-4" />
                )}
                {isHidden ? 'Afficher' : 'Masquer'}
              </DropdownMenuItem>
              {canWrap && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Group className="mr-2 size-4" />
                      {wrapLabel}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleWrap('section')}>
                        <RectangleHorizontal className="mr-2 size-4" />
                        Section
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWrap('container')}>
                        <Box className="mr-2 size-4" />
                        Conteneur
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleWrap('columns')}>
                        <Columns3 className="mr-2 size-4" />
                        Colonnes
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {isInMultiSelection && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      removeMany(selectedIds)
                      toast.success(`${selectedIds.length} blocs supprimés`)
                    }}
                    variant="destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Supprimer la sélection
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  removeBlock(block.id)
                  toast.success('Bloc supprimé')
                }}
                variant="destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* The actual rendered block.
       *  For containers we DON'T set pointer-events:none so users can still
       *  click on inner children / drop zones. */}
      <div
        ref={innerRef}
        className={cn(!isContainer && isSelected && 'pointer-events-none select-none')}
      >
        <BlockRenderer
          block={block}
          device={device}
          slot={slot}
          slotByIndex={slotByIndex}
          skipSelfPosition={freeAbsolute}
        />
      </div>

      {/* Bottom "+" button to insert a sibling after this block */}
      {(isHovered || isSelected) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openPicker(block.id, block.parentId ?? null, block.slotIndex ?? null)
          }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-110 transition-transform animate-in fade-in-0 zoom-in-90 duration-150"
          title="Insérer un bloc en dessous (⌘/)"
        >
          <Plus className="size-3.5" />
        </button>
      )}

      {/* Poignée de redimensionnement sur le bord droit du bloc */}
      {canResize && handleX != null && (
        <div
          aria-label="Largeur du bloc"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none"
          style={{ left: handleX }}
          title="Glisser pour redimensionner"
        >
          <div className="h-10 w-1.5 rounded-full bg-primary shadow ring-2 ring-background transition-transform hover:scale-110" />
          {liveWidthPct != null && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              {liveWidthPct}%
            </div>
          )}
        </div>
      )}
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem
          onClick={() => {
            duplicateBlock(block.id)
            toast.success('Bloc dupliqué')
          }}
        >
          <Copy />
          Dupliquer
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => copyBlock(block.id)}>
          <ClipboardCopy />
          Copier
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            cutBlock(block.id)
            toast.success('Bloc coupé')
          }}
        >
          <Scissors />
          Couper
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasClipboard} onClick={() => pasteBlock(block.id)}>
          <ClipboardPaste />
          Coller
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={openSnippetDialog}>
          <BookmarkPlus />
          Enregistrer comme snippet
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            copyBlockStyle(block.id)
            toast.success('Style copié')
          }}
        >
          <Palette />
          Copier le style
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasStyleClipboard}
          onClick={() => {
            pasteBlockStyle(isInMultiSelection ? selectedIds : [block.id])
            toast.success('Style appliqué')
          }}
        >
          <Brush />
          Coller le style
        </ContextMenuItem>
        {canConvertToGlobal && (
          <ContextMenuItem disabled={converting} onClick={handleConvertToGlobal}>
            <Boxes />
            Convertir en bloc global
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem disabled={isFirst} onClick={() => moveBlock(block.id, 'up')}>
          <ArrowUp />
          Monter
          <ContextMenuShortcut>⌥↑</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={isLast} onClick={() => moveBlock(block.id, 'down')}>
          <ArrowDown />
          Descendre
          <ContextMenuShortcut>⌥↓</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() =>
            openPicker(block.id, block.parentId ?? null, block.slotIndex ?? null)
          }
        >
          <Plus />
          Insérer un bloc
          <ContextMenuShortcut>⌘/</ContextMenuShortcut>
        </ContextMenuItem>
        {block.parentId && (
          <ContextMenuItem
            onClick={() => {
              moveToContainer(block.id, null, null)
              toast.success('Bloc sorti du conteneur')
            }}
          >
            <Ungroup />
            Sortir du conteneur
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            updateBlockMeta(block.id, { locked: !isLocked })
            toast.success(isLocked ? 'Bloc déverrouillé' : 'Bloc verrouillé')
          }}
        >
          {isLocked ? <Unlock /> : <Lock />}
          {isLocked ? 'Déverrouiller' : 'Verrouiller'}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            updateBlockMeta(block.id, { hidden: !isHidden })
            toast.success(isHidden ? 'Bloc affiché' : 'Bloc masqué')
          }}
        >
          {isHidden ? <Eye /> : <EyeOff />}
          {isHidden ? 'Afficher' : 'Masquer'}
        </ContextMenuItem>
        {canWrap && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Group />
                {wrapLabel}
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => handleWrap('section')}>
                  <RectangleHorizontal />
                  Section
                  <ContextMenuShortcut>⌘G</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleWrap('container')}>
                  <Box />
                  Conteneur
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleWrap('columns')}>
                  <Columns3 />
                  Colonnes
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </>
        )}
        {isInMultiSelection && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => {
                removeMany(selectedIds)
                toast.success(`${selectedIds.length} blocs supprimés`)
              }}
            >
              <Trash2 />
              Supprimer la sélection
            </ContextMenuItem>
          </>
        )}
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
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => {
            removeBlock(block.id)
            toast.success('Bloc supprimé')
          }}
        >
          <Trash2 />
          Supprimer
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <Dialog open={snippetDialogOpen} onOpenChange={setSnippetDialogOpen}>
      <DialogContent
        className="sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Enregistrer comme snippet</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="snippet-name">Nom</Label>
            <Input
              id="snippet-name"
              autoFocus
              value={snippetName}
              onChange={(e) => setSnippetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !savingSnippet) {
                  e.preventDefault()
                  void handleSaveSnippet()
                }
              }}
              placeholder="Nom du snippet"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="snippet-description">Description (optionnel)</Label>
            <Textarea
              id="snippet-description"
              value={snippetDescription}
              onChange={(e) => setSnippetDescription(e.target.value)}
              placeholder="À quoi sert ce bloc réutilisable ?"
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setSnippetDialogOpen(false)}
            disabled={savingSnippet}
          >
            Annuler
          </Button>
          <Button onClick={handleSaveSnippet} disabled={savingSnippet}>
            <BookmarkPlus className="mr-2 size-4" />
            {savingSnippet ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

// ─────────────────────────── Children list ───────────────────────────
//  Renders the children of a container/column. Each child is wrapped in
//  another <BlockWrapper> recursively, so nested containers work naturally.
//  Empty containers show a styled drop-zone with an "Add block" CTA.
// ─────────────────────────────────────────────────────────────────────

interface ChildrenListProps {
  parentId: string
  slotIndex: number | null
  items: BlockProps[]
  emptyLabel: string
  /** When set, applied to the element wrapping the children (Flex/Grid mode). */
  layoutClass?: string | null
}

function ChildrenList({ parentId, slotIndex, items, emptyLabel, layoutClass }: ChildrenListProps) {
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${parentId}:${slotIndex ?? 'null'}`,
  })

  if (items.length === 0) {
    return (
      <button
        ref={setDropRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openPicker(null, parentId, slotIndex)
        }}
        className={cn(
          'group/dropzone m-2 flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-xs transition-all',
          isOver
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/60 bg-card/40 text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary'
        )}
      >
        <Plus className="size-4" />
        <span className="font-medium">
          {isOver ? 'Déposer ici' : `${emptyLabel} — ajouter un bloc`}
        </span>
      </button>
    )
  }

  return (
    // pt-8 leaves room for the first child's hover toolbar (-top-7 = -28px).
    <div className="pt-8 pb-2 px-2 min-h-full">
      <div className={layoutClass ?? 'space-y-6'}>
        {items.map((child, idx) => (
          <BlockWrapper
            key={child.id}
            block={child}
            siblingIndex={idx}
            siblingCount={items.length}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openPicker(items[items.length - 1]?.id ?? null, parentId, slotIndex)
        }}
        className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition"
      >
        <Plus className="size-3" />
        Ajouter un bloc
      </button>
    </div>
  )
}
