import { create } from 'zustand'
import { BlockProps, PageData } from './types'

interface PageBuilderStore {
  page: PageData | null
  blocks: BlockProps[]
  selectedBlockId: string | null
  isSaving: boolean

  setPage: (page: PageData) => void
  setBlocks: (blocks: BlockProps[]) => void
  selectBlock: (id: string | null) => void
  setIsSaving: (saving: boolean) => void
  addBlock: (block: BlockProps) => void
  removeBlock: (id: string) => void
  updateBlock: (id: string, props: Record<string, unknown>) => void
  duplicateBlock: (id: string) => void
  moveBlock: (id: string, direction: 'up' | 'down') => void
  reset: () => void
}

export const usePageBuilderStore = create<PageBuilderStore>((set) => ({
  page: null,
  blocks: [],
  selectedBlockId: null,
  isSaving: false,

  setPage: (page) => set({ page }),
  setBlocks: (blocks) => set({ blocks }),
  selectBlock: (id) => set({ selectedBlockId: id }),
  setIsSaving: (saving) => set({ isSaving: saving }),

  addBlock: (block) => set((state) => ({
    blocks: [...state.blocks, block]
  })),

  removeBlock: (id) => set((state) => ({
    blocks: state.blocks.filter((b) => b.id !== id),
    selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId
  })),

  updateBlock: (id: string, props: Record<string, unknown>) => set((state) => ({
    blocks: state.blocks.map((b) =>
      b.id === id ? { ...b, props: { ...b.props, ...props } } : b
    )
  })),

  duplicateBlock: (id) => set((state) => {
    const block = state.blocks.find((b) => b.id === id)
    if (!block) return state
    const newBlock = { ...block, id: `${block.id}-copy-${Date.now()}` }
    const idx = state.blocks.indexOf(block)
    const newBlocks = [...state.blocks]
    newBlocks.splice(idx + 1, 0, newBlock)
    return { blocks: newBlocks }
  }),

  moveBlock: (id, direction) => set((state) => {
    const idx = state.blocks.findIndex((b) => b.id === id)
    if (idx === -1) return state
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= state.blocks.length) return state
    const newBlocks = [...state.blocks]
    ;[newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]]
    return { blocks: newBlocks }
  }),

  reset: () => set({
    page: null,
    blocks: [],
    selectedBlockId: null,
    isSaving: false
  })
}))
