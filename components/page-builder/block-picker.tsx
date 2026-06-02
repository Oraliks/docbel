'use client'

import React from 'react'
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
  Bookmark,
  Boxes,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  BLOCK_REGISTRY,
  BLOCKS_BY_CATEGORY,
  BLOCK_CATEGORY_LABELS,
  type AnyBlockRegistryEntry,
} from '@/lib/page-builder/registry'
import type { BlockType, BlockCategory, BlockProps } from '@/lib/page-builder/types'
import { usePageBuilderStore } from '@/lib/page-builder/store'
import {
  listSnippets,
  deleteSnippet,
  cloneSnippetBlock,
  type Snippet,
} from '@/lib/page-builder/snippets'
import { toast } from 'sonner'
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

export function BlockPicker() {
  const open = usePageBuilderStore((s) => s.pickerOpen)
  const insertAfter = usePageBuilderStore((s) => s.pickerInsertAfter)
  const parentId = usePageBuilderStore((s) => s.pickerParentId)
  const slotIndex = usePageBuilderStore((s) => s.pickerSlotIndex)
  const closePicker = usePageBuilderStore((s) => s.closePicker)
  const addBlock = usePageBuilderStore((s) => s.addBlock)
  const insertBlock = usePageBuilderStore((s) => s.insertBlock)
  const globalBlocks = usePageBuilderStore((s) => s.globalBlocks)
  const setGlobalBlocks = usePageBuilderStore((s) => s.setGlobalBlocks)

  const [query, setQuery] = React.useState('')
  const [activeIdx, setActiveIdx] = React.useState(0)

  // ── "Mes snippets" — loaded from the DB when the picker opens ──
  const [snippets, setSnippets] = React.useState<Snippet[]>([])
  const [snippetsLoading, setSnippetsLoading] = React.useState(false)

  const loadSnippets = React.useCallback(async () => {
    setSnippetsLoading(true)
    try {
      setSnippets(await listSnippets())
    } catch {
      // Non-blocking: a snippet load failure shouldn't break the picker.
      setSnippets([])
    } finally {
      setSnippetsLoading(false)
    }
  }, [])

  // ── "Blocs globaux" — chargés depuis l'API à l'ouverture du picker ──
  const [globalItems, setGlobalItems] = React.useState<
    Array<{ id: string; name: string; block: BlockProps }>
  >([])
  const [globalLoading, setGlobalLoading] = React.useState(false)

  const loadGlobalBlocks = React.useCallback(async () => {
    setGlobalLoading(true)
    try {
      const res = await fetch('/api/page-builder/global-blocks')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGlobalItems(data.items ?? [])
    } catch {
      // Non-bloquant : un échec ne doit pas casser le picker.
      setGlobalItems([])
    } finally {
      setGlobalLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lazy-load à l'ouverture (flux async)
      void loadSnippets()
      void loadGlobalBlocks()
    }
  }, [open, loadSnippets, loadGlobalBlocks])

  const handleInsertSnippet = (snippet: Snippet) => {
    insertBlock(cloneSnippetBlock(snippet), {
      insertAfter,
      parentId,
      slotIndex,
    })
    closePicker()
    setQuery('')
    setActiveIdx(0)
  }

  const handleDeleteSnippet = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await deleteSnippet(id)
      setSnippets((prev) => prev.filter((s) => s.id !== id))
      toast.success('Snippet supprimé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de la suppression')
    }
  }

  const handleInsertGlobal = (item: { id: string; block: BlockProps }) => {
    // S'assure que la map du store contient le bloc résolu (sinon le globalRef
    // s'afficherait comme « référence non résolue » jusqu'au prochain reload).
    if (!globalBlocks[item.id]) {
      setGlobalBlocks({ ...globalBlocks, [item.id]: item.block })
    }
    insertBlock(
      { id: nanoid(), type: 'globalRef', props: { globalBlockId: item.id } },
      { insertAfter, parentId, slotIndex }
    )
    closePicker()
    setQuery('')
    setActiveIdx(0)
  }

  const handleDeleteGlobal = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/page-builder/global-blocks/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      setGlobalItems((prev) => prev.filter((g) => g.id !== id))
      toast.success('Bloc global supprimé')
    } catch {
      toast.error('Échec de la suppression')
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closePicker()
      // Reset state when the picker closes so the next open is fresh.
      setQuery('')
      setActiveIdx(0)
    }
  }

  const allEntries = React.useMemo(
    () =>
      (Object.values(BLOCK_REGISTRY) as AnyBlockRegistryEntry[]).filter(
        // `globalRef` n'est pas insérable brut : il s'insère via « Blocs globaux ».
        (entry) => entry.type !== 'globalRef'
      ),
    []
  )

  const filtered = React.useMemo(() => {
    if (!query.trim()) {
      return allEntries
    }
    const q = query.toLowerCase().trim()
    return allEntries.filter((entry) => {
      if (entry.name.toLowerCase().includes(q)) return true
      if (entry.description.toLowerCase().includes(q)) return true
      if (entry.shortcuts?.some((s) => s.toLowerCase().includes(q))) return true
      if (entry.type.toLowerCase().includes(q)) return true
      return false
    })
  }, [query, allEntries])

  const grouped = React.useMemo(() => {
    if (query.trim()) return { all: filtered }
    // Retire `globalRef` des catégories normales (inséré via « Blocs globaux »).
    return {
      ...BLOCKS_BY_CATEGORY,
      utility: BLOCKS_BY_CATEGORY.utility.filter((e) => e.type !== 'globalRef'),
    }
  }, [filtered, query])

  const flat = React.useMemo(() => {
    if (query.trim()) return filtered
    const out: typeof filtered = []
    ;(['text', 'media', 'layout', 'marketing'] as BlockCategory[]).forEach((cat) => {
      out.push(...BLOCKS_BY_CATEGORY[cat])
    })
    return out
  }, [filtered, query])

  const handleInsert = (type: BlockType) => {
    addBlock(type, { insertAfter, parentId, slotIndex })
    closePicker()
    setQuery('')
    setActiveIdx(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (i + 1) % flat.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i - 1 + flat.length) % flat.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = flat[activeIdx]
      if (target) handleInsert(target.type)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insérer un bloc</DialogTitle>
        </DialogHeader>

        <Input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActiveIdx(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un bloc (titre, image, hero, /h1…)"
          className="h-10"
        />

        <div className="-mx-1 max-h-[60vh] overflow-y-auto pr-2">
          {Object.entries(grouped).map(([cat, entries]) => {
            if (!entries || entries.length === 0) return null
            const label =
              cat in BLOCK_CATEGORY_LABELS
                ? BLOCK_CATEGORY_LABELS[cat as BlockCategory]
                : 'Résultats'
            return (
              <div key={cat} className="mt-4 first:mt-0">
                <div className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(entries as AnyBlockRegistryEntry[]).map((entry) => {
                    const Icon = ICON_MAP[entry.icon] ?? Box
                    const idx = flat.findIndex((e) => e.type === entry.type)
                    const isActive = idx === activeIdx
                    return (
                      <button
                        key={entry.type}
                        type="button"
                        onClick={() => handleInsert(entry.type)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition',
                          isActive
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'border-transparent hover:border-border hover:bg-muted/50'
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition',
                            isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{entry.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {entry.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Mes snippets — sections réutilisables enregistrées en DB. */}
          {!query.trim() && (snippetsLoading || snippets.length > 0) && (
            <div className="mt-4">
              <div className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mes snippets
              </div>
              {snippetsLoading ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Chargement…
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {snippets.map((snippet) => {
                    const blockMeta = BLOCK_REGISTRY[snippet.block?.type]
                    const Icon = blockMeta ? ICON_MAP[blockMeta.icon] ?? Bookmark : Bookmark
                    return (
                      <div
                        key={snippet.id}
                        className="group/snip flex items-center gap-3 rounded-lg border border-transparent bg-card p-3 text-left transition hover:border-border hover:bg-muted/50"
                      >
                        <button
                          type="button"
                          onClick={() => handleInsertSnippet(snippet)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{snippet.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {snippet.description || blockMeta?.name || 'Bloc'}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSnippet(e, snippet.id)}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/snip:opacity-100"
                          title="Supprimer le snippet"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Blocs globaux — références partagées, éditées à un seul endroit. */}
          {!query.trim() && (globalLoading || globalItems.length > 0) && (
            <div className="mt-4">
              <div className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Blocs globaux
              </div>
              {globalLoading ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  Chargement…
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {globalItems.map((item) => {
                    const blockMeta = BLOCK_REGISTRY[item.block?.type]
                    const Icon = blockMeta ? ICON_MAP[blockMeta.icon] ?? Boxes : Boxes
                    return (
                      <div
                        key={item.id}
                        className="group/glob flex items-center gap-3 rounded-lg border border-transparent bg-card p-3 text-left transition hover:border-border hover:bg-muted/50"
                      >
                        <button
                          type="button"
                          onClick={() => handleInsertGlobal(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {blockMeta?.name || 'Bloc global'}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteGlobal(e, item.id)}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/glob:opacity-100"
                          title="Supprimer le bloc global"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {flat.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun bloc ne correspond à « {query} »
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>↑↓ pour naviguer · ↵ pour insérer · Esc pour fermer</span>
          <span>{flat.length} bloc{flat.length !== 1 ? 's' : ''}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
