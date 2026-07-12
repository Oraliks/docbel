// =====================================================================
//  Page Builder — Zustand store
//  Single source of truth for the editor's state.
//
//  The interface below is the store's public contract. Its action
//  implementations live in ./store-slices.ts (grouped by concern) and
//  its pure helpers in ./store-helpers.ts — this file assembles them.
// =====================================================================

import { create } from 'zustand'
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
  PageVariable,
  ResponsiveOverride,
  ThemeTokens,
} from './types'
import type { BlocksSnapshot } from './store-helpers'
import {
  createCoreSlice,
  createCrudSlice,
  createLayersSlice,
  createBulkSlice,
  createClipboardSlice,
  createHistorySlice,
} from './store-slices'

export interface PageBuilderStore {
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

  // User-defined page variables ({{key}} interpolation)
  variables: PageVariable[]

  // Resolved global blocks (id → block content) for live globalRef resolution.
  globalBlocks: Record<string, BlockProps>

  // Save state
  isSaving: boolean
  isDirty: boolean

  // History
  past: BlocksSnapshot[]
  future: BlocksSnapshot[]

  // Clipboard (in-memory)
  clipboard: BlockProps | null
  // Copied visual styling (style + layout) for "paste style"
  styleClipboard: Pick<BlockProps, 'style' | 'layout'> | null

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
  setVariables: (vars: PageVariable[]) => void
  setGlobalBlocks: (map: Record<string, BlockProps>) => void
  updateGlobalBlockProps: (globalBlockId: string, props: Record<string, unknown>) => void
  /** Replace a block in place (same id) — used to convert a block into a globalRef. */
  replaceBlock: (id: string, block: BlockProps) => void

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
  insertTemplate: (
    templateBlocks: BlockProps[],
    opts?: { insertAfter?: string | null }
  ) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (id: string, direction: 'up' | 'down') => void
  reorderBlocks: (fromId: string, toId: string) => void
  moveToContainer: (
    id: string,
    parentId: string | null,
    slotIndex: number | null
  ) => void

  updateBlockProps: <T extends BlockType>(
    id: string,
    props: Partial<BlockPropsMap[T]>
  ) => void
  updateBlockStyle: (id: string, style: Partial<BlockStyle>) => void
  updateBlockLayout: (id: string, layout: Partial<BlockLayout>) => void
  /** Like updateBlockLayout but WITHOUT pushing history (for live drag). */
  updateBlockLayoutLive: (id: string, layout: Partial<BlockLayout>) => void
  /** Snapshots current blocks into history (call once before a live drag). */
  pushHistoryCheckpoint: () => void
  /** Merge a style/layout patch onto MANY blocks at once (group editing). */
  updateManyBlocksStyle: (ids: string[], style: Partial<BlockStyle>) => void
  updateManyBlocksLayout: (ids: string[], layout: Partial<BlockLayout>) => void
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
  wrapInContainer: (
    ids: string[],
    containerType: 'section' | 'container' | 'columns'
  ) => void

  // Clipboard
  copyBlock: (id: string) => void
  cutBlock: (id: string) => void
  pasteBlock: (afterId?: string | null) => void
  /** Copy a block's visual styling (style + layout). */
  copyBlockStyle: (id: string) => void
  /** Apply the copied styling onto one or more blocks. */
  pasteBlockStyle: (ids: string[]) => void
  /** Apply an explicit style+layout payload onto one or more blocks (presets). */
  applyStyle: (ids: string[], payload: Pick<BlockProps, 'style' | 'layout'>) => void

  // Find & replace
  /**
   * Replace every literal, case-sensitive occurrence of `find` with `replace`
   * across all string values inside every block's `props` (recursively).
   * One undo step. No-op when `find` is empty.
   */
  replaceText: (find: string, replace: string) => void

  // History
  undo: () => void
  redo: () => void
  reset: () => void
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
  variables: [],
  globalBlocks: {},
  isSaving: false,
  isDirty: false,

  past: [],
  future: [],
  clipboard: null,
  styleClipboard: null,

  // ── actions (assembled from slices) ───────────────────────────────
  ...createCoreSlice(set),
  ...createCrudSlice(set),
  ...createLayersSlice(set),
  ...createBulkSlice(set, get),
  ...createClipboardSlice(set, get),
  ...createHistorySlice(set, get),
}))

// ── helpers (public API — re-exported for consumers of ./store) ───────
export { getChildrenOf, getRootBlocks } from './store-helpers'

// ── selectors ────────────────────────────────────────────────────────
export const selectSelectedBlock = (s: PageBuilderStore) =>
  s.blocks.find((b) => b.id === s.selectedBlockId) ?? null
