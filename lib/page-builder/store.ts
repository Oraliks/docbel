// =====================================================================
//  Page Builder — Zustand store
//  Single source of truth for the editor's state.
// =====================================================================

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  BlockProps,
  BlockType,
  BlockPropsMap,
  BlockStyle,
  BlockLayout,
  BlockAdvanced,
  BlockMeta,
  DeviceType,
  PageData,
  ResponsiveOverride,
  ThemeTokens,
} from './types'
import { getBlockDef } from './registry'

const HISTORY_LIMIT = 80

interface BlocksSnapshot {
  blocks: BlockProps[]
}

interface PageBuilderStore {
  // Core data
  page: PageData | null
  blocks: BlockProps[]

  // Selection / hover
  selectedBlockId: string | null
  selectedIds: string[] // multi-select; selectedBlockId is the primary
  hoveredBlockId: string | null

  // Editor UI state
  device: DeviceType
  previewMode: boolean
  pickerOpen: boolean
  pickerInsertAfter: string | null // block id to insert after; null = append
  pickerParentId: string | null // when set, new block is created inside this parent
  pickerSlotIndex: number | null // slot index inside parent (for columns)

  // Theme tokens (per-page palette)
  themeTokens: ThemeTokens | null

  // Save state
  isSaving: boolean
  isDirty: boolean

  // History
  past: BlocksSnapshot[]
  future: BlocksSnapshot[]

  // Clipboard (in-memory)
  clipboard: BlockProps | null

  // ── actions ────────────────────────────────────────────────────────
  setPage: (page: PageData) => void
  setBlocks: (blocks: BlockProps[], opts?: { skipHistory?: boolean }) => void

  selectBlock: (id: string | null) => void
  toggleSelection: (id: string) => void
  selectMany: (ids: string[]) => void
  clearSelection: () => void
  hoverBlock: (id: string | null) => void

  setDevice: (device: DeviceType) => void
  setPreviewMode: (preview: boolean) => void
  togglePreviewMode: () => void

  openPicker: (
    insertAfter?: string | null,
    parentId?: string | null,
    slotIndex?: number | null
  ) => void
  closePicker: () => void

  setIsSaving: (saving: boolean) => void
  setIsDirty: (dirty: boolean) => void
  setThemeTokens: (tokens: ThemeTokens | null) => void

  // Block CRUD
  addBlock: (
    type: BlockType,
    opts?: {
      insertAfter?: string | null
      parentId?: string | null
      slotIndex?: number | null
    }
  ) => string
  insertBlock: (
    block: BlockProps,
    opts?: {
      insertAfter?: string | null
      parentId?: string | null
      slotIndex?: number | null
    }
  ) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (id: string, direction: 'up' | 'down') => void
  reorderBlocks: (fromId: string, toId: string) => void

  updateBlockProps: <T extends BlockType>(
    id: string,
    props: Partial<BlockPropsMap[T]>
  ) => void
  updateBlockStyle: (id: string, style: Partial<BlockStyle>) => void
  updateBlockLayout: (id: string, layout: Partial<BlockLayout>) => void
  updateBlockAdvanced: (id: string, advanced: Partial<BlockAdvanced>) => void
  updateBlockResponsive: (
    id: string,
    device: 'tablet' | 'mobile',
    override: Partial<ResponsiveOverride>
  ) => void
  updateBlockMeta: (id: string, meta: Partial<BlockMeta>) => void

  // Bulk operations
  removeMany: (ids: string[]) => void
  duplicateMany: (ids: string[]) => void
  /** Wrap one or more blocks into a Section as their parent. */
  wrapInSection: (ids: string[]) => void

  // Clipboard
  copyBlock: (id: string) => void
  cutBlock: (id: string) => void
  pasteBlock: (afterId?: string | null) => void

  // History
  undo: () => void
  redo: () => void
  reset: () => void
}

function pushHistory(state: PageBuilderStore, next: BlockProps[]): Partial<PageBuilderStore> {
  const past = [...state.past, { blocks: state.blocks }]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { blocks: next, past, future: [], isDirty: true }
}

function makeBlock(type: BlockType): BlockProps {
  const def = getBlockDef(type)
  if (!def) throw new Error(`Unknown block type: ${type}`)
  return {
    id: nanoid(),
    type,
    props: structuredClone(def.defaults),
  } as BlockProps
}

function cloneBlock(block: BlockProps, newId = nanoid()): BlockProps {
  return structuredClone({ ...block, id: newId })
}

function insertAt<T>(arr: T[], item: T, afterId: string | null | undefined, getId: (x: T) => string): T[] {
  if (!afterId) return [...arr, item]
  const idx = arr.findIndex((x) => getId(x) === afterId)
  if (idx === -1) return [...arr, item]
  const next = [...arr]
  next.splice(idx + 1, 0, item)
  return next
}

/** Returns ids of `id` plus all descendants (children, grand-children…) */
function descendantIds(blocks: BlockProps[], id: string): string[] {
  const out: string[] = [id]
  const stack = [id]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const b of blocks) {
      if (b.parentId === current) {
        out.push(b.id)
        stack.push(b.id)
      }
    }
  }
  return out
}

export const usePageBuilderStore = create<PageBuilderStore>((set, get) => ({
  // ── state ────────────────────────────────────────────────────────
  page: null,
  blocks: [],
  selectedBlockId: null,
  selectedIds: [],
  hoveredBlockId: null,

  device: 'desktop',
  previewMode: false,
  pickerOpen: false,
  pickerInsertAfter: null,
  pickerParentId: null,
  pickerSlotIndex: null,

  themeTokens: null,
  isSaving: false,
  isDirty: false,

  past: [],
  future: [],
  clipboard: null,

  // ── basic setters ────────────────────────────────────────────────
  setPage: (page) => set({ page }),

  setBlocks: (blocks, opts) =>
    set((state) =>
      opts?.skipHistory ? { blocks } : pushHistory(state, blocks)
    ),

  selectBlock: (id) => set({ selectedBlockId: id, selectedIds: id ? [id] : [] }),
  toggleSelection: (id) =>
    set((state) => {
      const sel = state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id]
      return {
        selectedIds: sel,
        selectedBlockId: sel.length > 0 ? sel[sel.length - 1] : null,
      }
    }),
  selectMany: (ids) =>
    set({
      selectedIds: ids,
      selectedBlockId: ids.length > 0 ? ids[ids.length - 1] : null,
    }),
  clearSelection: () => set({ selectedBlockId: null, selectedIds: [] }),
  hoverBlock: (id) => set({ hoveredBlockId: id }),

  setDevice: (device) => set({ device }),
  setPreviewMode: (preview) => set({ previewMode: preview }),
  togglePreviewMode: () => set((s) => ({ previewMode: !s.previewMode })),

  openPicker: (insertAfter = null, parentId = null, slotIndex = null) =>
    set({
      pickerOpen: true,
      pickerInsertAfter: insertAfter ?? null,
      pickerParentId: parentId ?? null,
      pickerSlotIndex: slotIndex ?? null,
    }),
  closePicker: () =>
    set({
      pickerOpen: false,
      pickerInsertAfter: null,
      pickerParentId: null,
      pickerSlotIndex: null,
    }),

  setIsSaving: (saving) => set({ isSaving: saving }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setThemeTokens: (tokens) => set({ themeTokens: tokens, isDirty: true }),

  // ── CRUD ─────────────────────────────────────────────────────────
  addBlock: (type, opts) => {
    const block = makeBlock(type)
    if (opts?.parentId !== undefined && opts.parentId !== null) {
      block.parentId = opts.parentId
      if (opts.slotIndex != null) block.slotIndex = opts.slotIndex
    }
    set((state) => {
      const next = insertAt(state.blocks, block, opts?.insertAfter ?? null, (b) => b.id)
      return { ...pushHistory(state, next), selectedBlockId: block.id }
    })
    return block.id
  },

  insertBlock: (block, opts) => {
    let toInsert = block
    if (opts?.parentId !== undefined && opts.parentId !== null) {
      toInsert = { ...block, parentId: opts.parentId, slotIndex: opts.slotIndex ?? undefined }
    }
    set((state) => {
      const next = insertAt(state.blocks, toInsert, opts?.insertAfter ?? null, (b) => b.id)
      return { ...pushHistory(state, next), selectedBlockId: toInsert.id }
    })
  },

  removeBlock: (id) =>
    set((state) => {
      const idsToRemove = new Set(descendantIds(state.blocks, id))
      const next = state.blocks.filter((b) => !idsToRemove.has(b.id))
      return {
        ...pushHistory(state, next),
        selectedBlockId: idsToRemove.has(state.selectedBlockId ?? '')
          ? null
          : state.selectedBlockId,
        hoveredBlockId: idsToRemove.has(state.hoveredBlockId ?? '')
          ? null
          : state.hoveredBlockId,
      }
    }),

  duplicateBlock: (id) =>
    set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id)
      if (idx === -1) return state

      // Recursively clone the block and all its descendants, mapping old IDs to new ones.
      const idMap = new Map<string, string>()
      const subtreeIds = descendantIds(state.blocks, id)
      for (const sid of subtreeIds) idMap.set(sid, nanoid())

      const cloned: BlockProps[] = subtreeIds.map((sid) => {
        const src = state.blocks.find((b) => b.id === sid)!
        const newId = idMap.get(sid)!
        const newParent = src.parentId ? idMap.get(src.parentId) ?? src.parentId : src.parentId
        return structuredClone({ ...src, id: newId, parentId: newParent })
      })

      const next = [...state.blocks]
      // Insert all cloned blocks right after the original. The first cloned block
      // is the new root copy; the rest are its descendants and their relative order
      // is preserved from `descendantIds`.
      next.splice(idx + 1, 0, ...cloned)

      return { ...pushHistory(state, next), selectedBlockId: cloned[0].id }
    }),

  moveBlock: (id, direction) =>
    set((state) => {
      const block = state.blocks.find((b) => b.id === id)
      if (!block) return state
      // Find sibling (same parent + same slot).
      const siblings = state.blocks.filter(
        (b) =>
          (b.parentId ?? null) === (block.parentId ?? null) &&
          (b.slotIndex ?? null) === (block.slotIndex ?? null)
      )
      const sibIdx = siblings.findIndex((b) => b.id === id)
      const targetSibIdx = direction === 'up' ? sibIdx - 1 : sibIdx + 1
      if (targetSibIdx < 0 || targetSibIdx >= siblings.length) return state

      const targetSibling = siblings[targetSibIdx]
      const fromIdx = state.blocks.findIndex((b) => b.id === id)
      const toIdx = state.blocks.findIndex((b) => b.id === targetSibling.id)
      const next = [...state.blocks]
      const [moved] = next.splice(fromIdx, 1)
      // After splice, recompute target index since it shifts when from < to
      const adjustedToIdx = fromIdx < toIdx ? toIdx : toIdx
      next.splice(direction === 'up' ? adjustedToIdx : adjustedToIdx + 1, 0, moved)
      return pushHistory(state, next)
    }),

  reorderBlocks: (fromId, toId) =>
    set((state) => {
      if (fromId === toId) return state
      const fromIdx = state.blocks.findIndex((b) => b.id === fromId)
      const toIdx = state.blocks.findIndex((b) => b.id === toId)
      if (fromIdx === -1 || toIdx === -1) return state

      const fromBlock = state.blocks[fromIdx]
      const toBlock = state.blocks[toIdx]

      // Don't allow dropping a block onto its own descendant (would create a cycle).
      const subtree = new Set(descendantIds(state.blocks, fromId))
      if (subtree.has(toId)) return state

      // The dragged block adopts the parent + slotIndex of the drop target,
      // so cross-container drag works. (For top-level → top-level it's a no-op.)
      const movedBlock: BlockProps = {
        ...fromBlock,
        parentId: toBlock.parentId ?? null,
        slotIndex: toBlock.slotIndex,
      }

      const next = [...state.blocks]
      next.splice(fromIdx, 1)
      const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
      next.splice(adjustedToIdx, 0, movedBlock)
      return pushHistory(state, next)
    }),

  // ── per-layer updates ────────────────────────────────────────────
  updateBlockProps: (id, props) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) =>
          b.id === id
            ? ({ ...b, props: { ...b.props, ...props } } as BlockProps)
            : b
        )
      )
    ),

  updateBlockStyle: (id, style) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) =>
          b.id === id ? { ...b, style: { ...(b.style ?? {}), ...style } } : b
        )
      )
    ),

  updateBlockLayout: (id, layout) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) =>
          b.id === id ? { ...b, layout: { ...(b.layout ?? {}), ...layout } } : b
        )
      )
    ),

  updateBlockAdvanced: (id, advanced) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) =>
          b.id === id ? { ...b, advanced: { ...(b.advanced ?? {}), ...advanced } } : b
        )
      )
    ),

  updateBlockResponsive: (id, device, override) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) => {
          if (b.id !== id) return b
          const prev = b.responsive ?? {}
          const prevDev = prev[device] ?? {}
          return {
            ...b,
            responsive: {
              ...prev,
              [device]: {
                style: { ...(prevDev.style ?? {}), ...(override.style ?? {}) },
                layout: { ...(prevDev.layout ?? {}), ...(override.layout ?? {}) },
              },
            },
          }
        })
      )
    ),

  updateBlockMeta: (id, meta) =>
    set((state) =>
      pushHistory(
        state,
        state.blocks.map((b) =>
          b.id === id ? { ...b, meta: { ...(b.meta ?? {}), ...meta } } : b
        )
      )
    ),

  // ── Bulk ─────────────────────────────────────────────────────────
  removeMany: (ids) =>
    set((state) => {
      const all = new Set<string>()
      for (const id of ids) {
        for (const d of descendantIds(state.blocks, id)) all.add(d)
      }
      const next = state.blocks.filter((b) => !all.has(b.id))
      return {
        ...pushHistory(state, next),
        selectedBlockId: null,
        selectedIds: [],
      }
    }),

  duplicateMany: (ids) =>
    set((state) => {
      let blocks = state.blocks
      const newIds: string[] = []

      // Duplicate each id (simple: duplicate one by one, reusing the recursive logic).
      for (const id of ids) {
        const idx = blocks.findIndex((b) => b.id === id)
        if (idx === -1) continue
        const idMap = new Map<string, string>()
        const subtree = descendantIds(blocks, id)
        for (const sid of subtree) idMap.set(sid, nanoid())
        const cloned: BlockProps[] = subtree.map((sid) => {
          const src = blocks.find((b) => b.id === sid)!
          const newId = idMap.get(sid)!
          const newParent = src.parentId ? idMap.get(src.parentId) ?? src.parentId : src.parentId
          return structuredClone({ ...src, id: newId, parentId: newParent })
        })
        const next = [...blocks]
        next.splice(idx + 1, 0, ...cloned)
        blocks = next
        newIds.push(cloned[0].id)
      }

      return { ...pushHistory(state, blocks), selectedBlockId: newIds[0] ?? null, selectedIds: newIds }
    }),

  wrapInSection: (ids) =>
    set((state) => {
      if (ids.length === 0) return state
      // Only handles top-level blocks for now (most common case).
      const targets = state.blocks.filter((b) => ids.includes(b.id) && !b.parentId)
      if (targets.length === 0) return state

      const sectionDef = getBlockDef('section')
      if (!sectionDef) return state
      const section: BlockProps = {
        id: nanoid(),
        type: 'section',
        props: structuredClone(sectionDef.defaults),
      } as BlockProps

      // First target's index becomes the section's position
      const firstIdx = state.blocks.findIndex((b) => b.id === targets[0].id)
      const targetIds = new Set(targets.map((t) => t.id))

      const next: BlockProps[] = []
      for (let i = 0; i < state.blocks.length; i++) {
        const b = state.blocks[i]
        if (i === firstIdx) next.push(section)
        if (targetIds.has(b.id)) {
          next.push({ ...b, parentId: section.id, slotIndex: undefined })
        } else {
          next.push(b)
        }
      }

      return { ...pushHistory(state, next), selectedBlockId: section.id, selectedIds: [section.id] }
    }),

  // ── clipboard ────────────────────────────────────────────────────
  copyBlock: (id) => {
    const block = get().blocks.find((b) => b.id === id)
    if (block) set({ clipboard: cloneBlock(block) })
  },

  cutBlock: (id) => {
    const block = get().blocks.find((b) => b.id === id)
    if (!block) return
    set({ clipboard: cloneBlock(block) })
    get().removeBlock(id)
  },

  pasteBlock: (afterId) => {
    const clip = get().clipboard
    if (!clip) return
    const copy = cloneBlock(clip)
    set((state) => {
      const next = insertAt(state.blocks, copy, afterId ?? null, (b) => b.id)
      return { ...pushHistory(state, next), selectedBlockId: copy.id }
    })
  },

  // ── history ──────────────────────────────────────────────────────
  undo: () => {
    const { past, blocks, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      blocks: previous.blocks,
      past: past.slice(0, -1),
      future: [{ blocks }, ...future].slice(0, HISTORY_LIMIT),
      isDirty: true,
    })
  },

  redo: () => {
    const { past, blocks, future } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      blocks: next.blocks,
      past: [...past, { blocks }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      isDirty: true,
    })
  },

  reset: () =>
    set({
      page: null,
      blocks: [],
      selectedBlockId: null,
      selectedIds: [],
      hoveredBlockId: null,
      device: 'desktop',
      previewMode: false,
      pickerOpen: false,
      pickerInsertAfter: null,
      pickerParentId: null,
      pickerSlotIndex: null,
      themeTokens: null,
      isSaving: false,
      isDirty: false,
      past: [],
      future: [],
      clipboard: null,
    }),
}))

// ── helpers ──────────────────────────────────────────────────────────
/** Returns direct children of a parent block, optionally filtered by slot index. */
export function getChildrenOf(
  blocks: BlockProps[],
  parentId: string,
  slotIndex?: number | null
): BlockProps[] {
  return blocks.filter((b) => {
    if (b.parentId !== parentId) return false
    if (slotIndex == null) return true
    return (b.slotIndex ?? 0) === slotIndex
  })
}

/** Returns top-level (root) blocks. */
export function getRootBlocks(blocks: BlockProps[]): BlockProps[] {
  return blocks.filter((b) => !b.parentId)
}

// ── selectors ────────────────────────────────────────────────────────
export const selectBlocks = (s: PageBuilderStore) => s.blocks
export const selectSelectedId = (s: PageBuilderStore) => s.selectedBlockId
export const selectSelectedBlock = (s: PageBuilderStore) =>
  s.blocks.find((b) => b.id === s.selectedBlockId) ?? null
