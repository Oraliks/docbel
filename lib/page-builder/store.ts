import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { BlockProps, PageData } from './types'

const HISTORY_LIMIT = 50

interface PageBuilderStore {
  page: PageData | null
  blocks: BlockProps[]
  selectedBlockId: string | null
  isSaving: boolean
  isDirty: boolean

  past: BlockProps[][]
  future: BlockProps[][]

  setPage: (page: PageData) => void
  setBlocks: (blocks: BlockProps[], opts?: { skipHistory?: boolean }) => void
  selectBlock: (id: string | null) => void
  setIsSaving: (saving: boolean) => void
  setIsDirty: (dirty: boolean) => void
  addBlock: (block: BlockProps) => void
  removeBlock: (id: string) => void
  updateBlock: (id: string, props: Record<string, unknown>) => void
  duplicateBlock: (id: string) => void
  moveBlock: (id: string, direction: 'up' | 'down') => void
  reorderBlocks: (fromId: string, toId: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
}

function pushHistory(state: PageBuilderStore, next: BlockProps[]): Partial<PageBuilderStore> {
  const past = [...state.past, state.blocks]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { blocks: next, past, future: [], isDirty: true }
}

export const usePageBuilderStore = create<PageBuilderStore>((set, get) => ({
  page: null,
  blocks: [],
  selectedBlockId: null,
  isSaving: false,
  isDirty: false,
  past: [],
  future: [],

  setPage: (page) => set({ page }),

  setBlocks: (blocks, opts) =>
    set((state) =>
      opts?.skipHistory
        ? { blocks }
        : pushHistory(state, blocks)
    ),

  selectBlock: (id) => set({ selectedBlockId: id }),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  addBlock: (block) =>
    set((state) => pushHistory(state, [...state.blocks, block])),

  removeBlock: (id) =>
    set((state) => ({
      ...pushHistory(state, state.blocks.filter((b) => b.id !== id)),
      selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
    })),

  updateBlock: (id, props) =>
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

  duplicateBlock: (id) =>
    set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id)
      if (idx === -1) return state
      const original = state.blocks[idx]
      const copy = {
        ...original,
        id: nanoid(),
        props: { ...original.props },
      } as BlockProps
      const next = [...state.blocks]
      next.splice(idx + 1, 0, copy)
      return { ...pushHistory(state, next), selectedBlockId: copy.id }
    }),

  moveBlock: (id, direction) =>
    set((state) => {
      const idx = state.blocks.findIndex((b) => b.id === id)
      if (idx === -1) return state
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= state.blocks.length) return state
      const next = [...state.blocks]
      const [moved] = next.splice(idx, 1)
      next.splice(newIdx, 0, moved)
      return pushHistory(state, next)
    }),

  reorderBlocks: (fromId, toId) =>
    set((state) => {
      if (fromId === toId) return state
      const fromIdx = state.blocks.findIndex((b) => b.id === fromId)
      const toIdx = state.blocks.findIndex((b) => b.id === toId)
      if (fromIdx === -1 || toIdx === -1) return state
      const next = [...state.blocks]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return pushHistory(state, next)
    }),

  undo: () => {
    const { past, blocks, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      blocks: previous,
      past: past.slice(0, -1),
      future: [blocks, ...future].slice(0, HISTORY_LIMIT),
      isDirty: true,
    })
  },

  redo: () => {
    const { past, blocks, future } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      blocks: next,
      past: [...past, blocks].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      isDirty: true,
    })
  },

  reset: () =>
    set({
      page: null,
      blocks: [],
      selectedBlockId: null,
      isSaving: false,
      isDirty: false,
      past: [],
      future: [],
    }),
}))
