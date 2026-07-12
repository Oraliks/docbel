// =====================================================================
//  Page Builder store — action slices.
//  Each creator receives Zustand's (set, get) and returns a typed slice
//  of PageBuilderStore. Assembled in store.ts. Behaviour is unchanged
//  from the former single-file store — this only splits by concern so
//  each area stays navigable and the entry file (store.ts) stays lean.
// =====================================================================

import { nanoid } from 'nanoid'
import type { StoreApi } from 'zustand'
import type { BlockProps } from './types'
import type { PageBuilderStore } from './store'
import {
  HISTORY_LIMIT,
  pushHistory,
  makeBlock,
  cloneBlock,
  insertAt,
  descendantIds,
  deepReplaceText,
} from './store-helpers'
import { getBlockDef } from './registry'

type Set = StoreApi<PageBuilderStore>['setState']
type Get = StoreApi<PageBuilderStore>['getState']

// ── core: page data, selection, editor UI, theme, variables, globals ──
export function createCoreSlice(
  set: Set
): Pick<
  PageBuilderStore,
  | 'setPage'
  | 'setBlocks'
  | 'selectBlock'
  | 'toggleSelection'
  | 'selectMany'
  | 'clearSelection'
  | 'hoverBlock'
  | 'setDevice'
  | 'setPreviewMode'
  | 'togglePreviewMode'
  | 'openPicker'
  | 'closePicker'
  | 'setIsSaving'
  | 'setIsDirty'
  | 'setThemeTokens'
  | 'setVariables'
  | 'setGlobalBlocks'
  | 'updateGlobalBlockProps'
  | 'replaceBlock'
> {
  return {
    setPage: (page) => set({ page }),

    setBlocks: (blocks, opts) =>
      set((state) => (opts?.skipHistory ? { blocks } : pushHistory(state, blocks))),

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
    setVariables: (vars) => set({ variables: vars, isDirty: true }),
    setGlobalBlocks: (map) => set({ globalBlocks: map }),
    updateGlobalBlockProps: (globalBlockId, props) =>
      set((state) => {
        const current = state.globalBlocks[globalBlockId]
        if (!current) return state
        return {
          globalBlocks: {
            ...state.globalBlocks,
            [globalBlockId]: {
              ...current,
              props: { ...current.props, ...props },
            } as BlockProps,
          },
        }
      }),
    replaceBlock: (id, block) =>
      set((state) =>
        pushHistory(
          state,
          state.blocks.map((b) => (b.id === id ? block : b))
        )
      ),
  }
}

// ── CRUD: add / insert / remove / duplicate / move / reorder ──────────
export function createCrudSlice(
  set: Set
): Pick<
  PageBuilderStore,
  | 'addBlock'
  | 'insertBlock'
  | 'insertTemplate'
  | 'removeBlock'
  | 'duplicateBlock'
  | 'moveBlock'
  | 'reorderBlocks'
  | 'moveToContainer'
> {
  return {
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

    insertTemplate: (templateBlocks, opts) =>
      set((state) => {
        if (!templateBlocks.length) return state
        // Remap every template-local id to a fresh one, keeping parent links.
        const idMap = new Map<string, string>()
        for (const b of templateBlocks) idMap.set(b.id, nanoid())
        const cloned: BlockProps[] = templateBlocks.map((b) => {
          const copy = structuredClone(b)
          copy.id = idMap.get(b.id)!
          copy.parentId = b.parentId ? idMap.get(b.parentId) ?? null : null
          return copy
        })
        const rootId = cloned[0].id
        const next = [...state.blocks]
        const after = opts?.insertAfter ?? null
        const idx = after ? next.findIndex((b) => b.id === after) : -1
        if (idx !== -1) next.splice(idx + 1, 0, ...cloned)
        else next.push(...cloned)
        return {
          ...pushHistory(state, next),
          selectedBlockId: rootId,
          selectedIds: [rootId],
        }
      }),

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
        // After splice, the target index shifts down by one when the moved block
        // sat before it (from < to). Mirror the adjustment used in reorderBlocks.
        const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx
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

    moveToContainer: (id, parentId, slotIndex) =>
      set((state) => {
        const idx = state.blocks.findIndex((b) => b.id === id)
        if (idx === -1) return state
        // Prevent cycles: can't drop a block into itself or its own descendants.
        if (parentId) {
          if (parentId === id) return state
          if (new Set(descendantIds(state.blocks, id)).has(parentId)) return state
        }
        const block = state.blocks[idx]
        const samePlace =
          (block.parentId ?? null) === (parentId ?? null) &&
          (block.slotIndex ?? null) === (slotIndex ?? null)
        if (samePlace) return state

        const moved: BlockProps = {
          ...block,
          parentId: parentId ?? null,
          slotIndex: slotIndex ?? undefined,
        }
        const next = [...state.blocks]
        next.splice(idx, 1)
        // Land at the end of the target container/slot.
        let insertAtIdx = next.length
        for (let i = next.length - 1; i >= 0; i--) {
          const b = next[i]
          if (
            (b.parentId ?? null) === (parentId ?? null) &&
            (b.slotIndex ?? null) === (slotIndex ?? null)
          ) {
            insertAtIdx = i + 1
            break
          }
        }
        next.splice(insertAtIdx, 0, moved)
        return {
          ...pushHistory(state, next),
          selectedBlockId: moved.id,
          selectedIds: [moved.id],
        }
      }),
  }
}

// ── per-layer updates: props / style / layout / advanced / responsive ──
export function createLayersSlice(
  set: Set
): Pick<
  PageBuilderStore,
  | 'updateBlockProps'
  | 'updateBlockStyle'
  | 'updateBlockLayout'
  | 'updateBlockLayoutLive'
  | 'pushHistoryCheckpoint'
  | 'updateManyBlocksStyle'
  | 'updateManyBlocksLayout'
  | 'updateBlockAdvanced'
  | 'updateBlockResponsive'
  | 'updateBlockMeta'
> {
  return {
    updateBlockProps: (id, props) =>
      set((state) =>
        pushHistory(
          state,
          state.blocks.map((b) =>
            b.id === id ? ({ ...b, props: { ...b.props, ...props } } as BlockProps) : b
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

    updateBlockLayoutLive: (id, layout) =>
      set((state) => ({
        blocks: state.blocks.map((b) =>
          b.id === id ? { ...b, layout: { ...(b.layout ?? {}), ...layout } } : b
        ),
        isDirty: true,
      })),

    pushHistoryCheckpoint: () =>
      set((state) => {
        const past = [...state.past, { blocks: state.blocks }]
        if (past.length > HISTORY_LIMIT) past.shift()
        return { past, future: [], isDirty: true }
      }),

    updateManyBlocksStyle: (ids, style) =>
      set((state) => {
        const t = new Set(ids)
        return pushHistory(
          state,
          state.blocks.map((b) =>
            t.has(b.id) ? { ...b, style: { ...(b.style ?? {}), ...style } } : b
          )
        )
      }),

    updateManyBlocksLayout: (ids, layout) =>
      set((state) => {
        const t = new Set(ids)
        return pushHistory(
          state,
          state.blocks.map((b) =>
            t.has(b.id) ? { ...b, layout: { ...(b.layout ?? {}), ...layout } } : b
          )
        )
      }),

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
  }
}

// ── bulk operations: remove / duplicate / wrap ───────────────────────
export function createBulkSlice(
  set: Set,
  get: Get
): Pick<PageBuilderStore, 'removeMany' | 'duplicateMany' | 'wrapInSection' | 'wrapInContainer'> {
  return {
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

    wrapInSection: (ids) => get().wrapInContainer(ids, 'section'),

    wrapInContainer: (ids, containerType) =>
      set((state) => {
        if (ids.length === 0) return state
        // Only top-level blocks can be wrapped (most common case).
        const targets = state.blocks.filter((b) => ids.includes(b.id) && !b.parentId)
        if (targets.length === 0) return state

        const def = getBlockDef(containerType)
        if (!def) return state
        const wrapper: BlockProps = {
          id: nanoid(),
          type: containerType,
          props: structuredClone(def.defaults),
        } as BlockProps

        // Columns has slots → wrapped children land in the first column.
        const childSlot = containerType === 'columns' ? 0 : undefined
        // First target's index becomes the wrapper's position.
        const firstIdx = state.blocks.findIndex((b) => b.id === targets[0].id)
        const targetIds = new Set(targets.map((t) => t.id))

        const next: BlockProps[] = []
        for (let i = 0; i < state.blocks.length; i++) {
          const b = state.blocks[i]
          if (i === firstIdx) next.push(wrapper)
          if (targetIds.has(b.id)) {
            next.push({ ...b, parentId: wrapper.id, slotIndex: childSlot })
          } else {
            next.push(b)
          }
        }

        return {
          ...pushHistory(state, next),
          selectedBlockId: wrapper.id,
          selectedIds: [wrapper.id],
        }
      }),
  }
}

// ── clipboard: copy / cut / paste (blocks and styling) ────────────────
export function createClipboardSlice(
  set: Set,
  get: Get
): Pick<
  PageBuilderStore,
  'copyBlock' | 'cutBlock' | 'pasteBlock' | 'copyBlockStyle' | 'pasteBlockStyle' | 'applyStyle'
> {
  return {
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

    copyBlockStyle: (id) => {
      const block = get().blocks.find((b) => b.id === id)
      if (!block) return
      set({ styleClipboard: structuredClone({ style: block.style, layout: block.layout }) })
    },

    pasteBlockStyle: (ids) => {
      const clip = get().styleClipboard
      if (clip) get().applyStyle(ids, clip)
    },

    applyStyle: (ids, payload) =>
      set((state) => {
        if (ids.length === 0) return state
        const target = new Set(ids)
        return pushHistory(
          state,
          state.blocks.map((b) =>
            target.has(b.id)
              ? {
                  ...b,
                  style: payload.style ? structuredClone(payload.style) : undefined,
                  layout: payload.layout ? structuredClone(payload.layout) : undefined,
                }
              : b
          )
        )
      }),
  }
}

// ── find & replace + history (undo / redo / reset) ────────────────────
export function createHistorySlice(
  set: Set,
  get: Get
): Pick<PageBuilderStore, 'replaceText' | 'undo' | 'redo' | 'reset'> {
  return {
    replaceText: (find, replace) =>
      set((state) => {
        if (!find) return state
        let total = 0
        const next = state.blocks.map((b) => {
          const r = deepReplaceText(b.props, find, replace)
          if (r.count === 0) return b
          total += r.count
          return { ...b, props: r.value } as BlockProps
        })
        // Nothing matched → don't pollute the undo stack.
        if (total === 0) return state
        return pushHistory(state, next)
      }),

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
        variables: [],
        globalBlocks: {},
        isSaving: false,
        isDirty: false,
        past: [],
        future: [],
        clipboard: null,
      }),
  }
}
