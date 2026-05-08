'use client'

import React from 'react'
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
} from 'lucide-react'
import type { BlockProps } from '@/lib/page-builder/types'
import { BLOCK_REGISTRY } from '@/lib/page-builder/registry'
import { BlockRenderer } from './block-renderer'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePageBuilderStore, getChildrenOf } from '@/lib/page-builder/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface BlockWrapperProps {
  block: BlockProps
  /** Index among siblings (top-level or within a slot). Used to enable/disable move buttons. */
  siblingIndex: number
  siblingCount: number
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
  const wrapInSection = usePageBuilderStore((s) => s.wrapInSection)
  const removeMany = usePageBuilderStore((s) => s.removeMany)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: !!block.meta?.locked })

  const isSelected = selectedBlockId === block.id
  const isInMultiSelection = selectedIds.includes(block.id) && selectedIds.length > 1
  const isHovered = hoveredBlockId === block.id
  const isFirst = siblingIndex === 0
  const isLast = siblingIndex === siblingCount - 1
  const meta = BLOCK_REGISTRY[block.type]
  const isContainer =
    block.type === 'section' || block.type === 'container' || block.type === 'columns'
  const isLocked = !!block.meta?.locked
  const isHidden = !!block.meta?.hidden

  const wrapperStyle: React.CSSProperties = {
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
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      data-block-id={block.id}
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
            {...(isLocked ? {} : listeners)}
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
              {isInMultiSelection && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      wrapInSection(selectedIds)
                      toast.success(`${selectedIds.length} blocs groupés dans une section`)
                    }}
                  >
                    <Group className="mr-2 size-4" />
                    Grouper dans une Section
                  </DropdownMenuItem>
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
      <div className={cn(!isContainer && isSelected && 'pointer-events-none select-none')}>
        <BlockRenderer
          block={block}
          device={device}
          slot={slot}
          slotByIndex={slotByIndex}
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
    </div>
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
}

function ChildrenList({ parentId, slotIndex, items, emptyLabel }: ChildrenListProps) {
  const openPicker = usePageBuilderStore((s) => s.openPicker)

  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openPicker(null, parentId, slotIndex)
        }}
        className="group/dropzone w-full min-h-[88px] flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 bg-card/40 text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary transition-all m-2 px-3 py-4"
      >
        <Plus className="size-4" />
        <span className="font-medium">{emptyLabel} — ajouter un bloc</span>
      </button>
    )
  }

  return (
    // pt-8 leaves room for the first child's hover toolbar (-top-7 = -28px).
    <div className="space-y-6 pt-8 pb-2 px-2 min-h-full">
      {items.map((child, idx) => (
        <BlockWrapper
          key={child.id}
          block={child}
          siblingIndex={idx}
          siblingCount={items.length}
        />
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          openPicker(items[items.length - 1]?.id ?? null, parentId, slotIndex)
        }}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition"
      >
        <Plus className="size-3" />
        Ajouter un bloc
      </button>
    </div>
  )
}
