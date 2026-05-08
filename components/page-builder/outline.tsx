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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Heading,
  Type,
  Quote,
  Minus,
  ArrowUpDown,
  Image,
  Video,
  Images,
  Code,
  Square,
  Box,
  Columns3,
  Sparkles,
  Grid2x2,
  MousePointerClick,
  HelpCircle,
  MessageSquareQuote,
  BarChart3,
  Plus,
  GripVertical,
  ChevronDown,
  Lock,
  EyeOff,
  Search,
  X as XIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import { BLOCK_REGISTRY } from '@/lib/page-builder/registry'
import type {
  BlockProps,
  HeadingProps,
  TextProps,
  HeroProps,
  CtaProps,
  SectionProps,
  ImageProps,
  FeaturesProps,
  FaqProps,
  TestimonialProps,
  StatsProps,
  GalleryProps,
} from '@/lib/page-builder/types'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<string, LucideIcon> = {
  heading: Heading,
  type: Type,
  quote: Quote,
  minus: Minus,
  'arrow-up-down': ArrowUpDown,
  image: Image,
  video: Video,
  images: Images,
  code: Code,
  square: Square,
  box: Box,
  'columns-3': Columns3,
  sparkles: Sparkles,
  'grid-2x2': Grid2x2,
  'mouse-pointer-click': MousePointerClick,
  'help-circle': HelpCircle,
  'message-square-quote': MessageSquareQuote,
  'bar-chart-3': BarChart3,
}

function getBlockLabel(block: BlockProps): string {
  switch (block.type) {
    case 'heading':
      return (block.props as HeadingProps).text || 'Titre'
    case 'text':
      return ((block.props as TextProps).html || '').replace(/<[^>]+>/g, '').slice(0, 40) || 'Texte'
    case 'hero':
      return (block.props as HeroProps).title || 'Hero'
    case 'cta':
      return (block.props as CtaProps).text || (block.props as CtaProps).title || 'CTA'
    case 'section':
      return (block.props as SectionProps).bgType === 'image' ? 'Section (image)' : 'Section'
    case 'image':
      return (block.props as ImageProps).alt || 'Image'
    case 'features':
      return (block.props as FeaturesProps).title || 'Fonctionnalités'
    case 'faq':
      return (block.props as FaqProps).title || 'FAQ'
    case 'testimonial':
      return (block.props as TestimonialProps).title || 'Témoignage'
    case 'stats':
      return (block.props as StatsProps).title || 'Statistiques'
    case 'gallery':
      return `Galerie (${(block.props as GalleryProps).items?.length || 0})`
    default:
      return BLOCK_REGISTRY[block.type].name
  }
}

interface OutlineItemProps {
  block: BlockProps
  depth: number
  hasChildren: boolean
}

function OutlineItem({ block, depth, hasChildren }: OutlineItemProps) {
  const selectedBlockId = usePageBuilderStore((s) => s.selectedBlockId)
  const selectedIds = usePageBuilderStore((s) => s.selectedIds)
  const selectBlock = usePageBuilderStore((s) => s.selectBlock)
  const toggleSelection = usePageBuilderStore((s) => s.toggleSelection)
  const hoverBlock = usePageBuilderStore((s) => s.hoverBlock)
  const updateBlockMeta = usePageBuilderStore((s) => s.updateBlockMeta)
  const isSelected = selectedBlockId === block.id
  const isInMulti = selectedIds.includes(block.id) && selectedIds.length > 1

  const meta = BLOCK_REGISTRY[block.type]
  const Icon = ICON_MAP[meta.icon] ?? Box
  const isLocked = !!block.meta?.locked
  const isHidden = !!block.meta?.hidden

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, disabled: isLocked })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: 8 + depth * 14,
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      toggleSelection(block.id)
      return
    }
    selectBlock(block.id)
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-block-id="${block.id}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      onMouseEnter={() => hoverBlock(block.id)}
      onMouseLeave={() => hoverBlock(null)}
      className={cn(
        'group/outline-item flex items-center gap-1.5 rounded-md pr-1 py-1.5 text-sm cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary'
          : isInMulti
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'hover:bg-muted/60 text-foreground/80',
        isHidden && 'opacity-60'
      )}
    >
      <button
        type="button"
        className={cn(
          'opacity-0 group-hover/outline-item:opacity-60 transition-opacity',
          isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
        )}
        {...(isLocked ? {} : attributes)}
        {...(isLocked ? {} : listeners)}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3.5" />
      </button>
      {hasChildren ? (
        <ChevronDown className="size-3 text-muted-foreground/60" />
      ) : (
        <span className="w-3" />
      )}
      <Icon className={cn('size-4 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
      <span className="truncate flex-1">{getBlockLabel(block)}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover/outline-item:opacity-100 transition-opacity">
        <button
          type="button"
          className="size-5 rounded hover:bg-muted flex items-center justify-center"
          title={isHidden ? 'Afficher' : 'Masquer'}
          onClick={(e) => {
            e.stopPropagation()
            updateBlockMeta(block.id, { hidden: !isHidden })
          }}
        >
          <EyeOff className={cn('size-3', !isHidden && 'opacity-40')} />
        </button>
        <button
          type="button"
          className="size-5 rounded hover:bg-muted flex items-center justify-center"
          title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
          onClick={(e) => {
            e.stopPropagation()
            updateBlockMeta(block.id, { locked: !isLocked })
          }}
        >
          <Lock className={cn('size-3', !isLocked && 'opacity-40')} />
        </button>
      </div>
    </div>
  )
}

export function Outline() {
  const blocks = usePageBuilderStore((s) => s.blocks)
  const reorderBlocks = usePageBuilderStore((s) => s.reorderBlocks)
  const openPicker = usePageBuilderStore((s) => s.openPicker)
  const [query, setQuery] = React.useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderBlocks(String(active.id), String(over.id))
  }

  // Build a flattened, depth-aware list following the parent → child hierarchy.
  const flatAll = React.useMemo(() => {
    const out: { block: BlockProps; depth: number; hasChildren: boolean }[] = []

    const childrenMap = new Map<string | null, BlockProps[]>()
    for (const b of blocks) {
      const key = b.parentId ?? null
      if (!childrenMap.has(key)) childrenMap.set(key, [])
      childrenMap.get(key)!.push(b)
    }
    // Stable sort: for `columns` parents, group by slotIndex first
    for (const [parent, kids] of childrenMap.entries()) {
      const parentBlock = blocks.find((b) => b.id === parent)
      if (parentBlock?.type === 'columns') {
        kids.sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
      }
    }

    function visit(parentId: string | null, depth: number) {
      const kids = childrenMap.get(parentId) ?? []
      for (const k of kids) {
        const grandKids = childrenMap.get(k.id) ?? []
        out.push({ block: k, depth, hasChildren: grandKids.length > 0 })
        if (grandKids.length > 0) visit(k.id, depth + 1)
      }
    }
    visit(null, 0)
    return out
  }, [blocks])

  const flat = React.useMemo(() => {
    if (!query.trim()) return flatAll
    const q = query.toLowerCase().trim()
    return flatAll.filter((entry) =>
      getBlockLabel(entry.block).toLowerCase().includes(q) ||
      BLOCK_REGISTRY[entry.block.type].name.toLowerCase().includes(q) ||
      entry.block.type.toLowerCase().includes(q)
    )
  }, [flatAll, query])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Calques
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => openPicker()}
          title="Ajouter un bloc (⌘/)"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {flatAll.length > 0 && (
        <div className="px-2 pt-2 pb-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer…"
            className="h-7 pl-7 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {flatAll.length === 0 ? (
            <button
              type="button"
              onClick={() => openPicker()}
              className="w-full rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="mx-auto mb-1 size-4" />
              Ajouter un bloc
            </button>
          ) : flat.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Aucun résultat
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={flat.map((f) => f.block.id)} strategy={verticalListSortingStrategy}>
                {flat.map(({ block, depth, hasChildren }) => (
                  <OutlineItem
                    key={block.id}
                    block={block}
                    depth={depth}
                    hasChildren={hasChildren}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
