// =====================================================================
//  Page Builder store — pure helpers.
//  Extracted from store.ts so they can be unit-tested in isolation and
//  keep the store file focused on state assembly. No Zustand here.
// =====================================================================

import { nanoid } from 'nanoid'
import type { BlockProps, BlockType } from './types'
import { getBlockDef } from './registry'

/** Maximum number of snapshots kept in the undo/redo stacks. */
export const HISTORY_LIMIT = 80

export interface BlocksSnapshot {
  blocks: BlockProps[]
}

/**
 * Builds the state patch for a history-tracked mutation: pushes the current
 * blocks onto `past` (capped at {@link HISTORY_LIMIT}), sets the new blocks,
 * clears `future`, and marks the page dirty. Typed structurally so it stays
 * decoupled from the full store type; the result spreads into a store patch.
 */
export function pushHistory(
  state: { blocks: BlockProps[]; past: BlocksSnapshot[] },
  next: BlockProps[]
): { blocks: BlockProps[]; past: BlocksSnapshot[]; future: BlocksSnapshot[]; isDirty: boolean } {
  const past = [...state.past, { blocks: state.blocks }]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { blocks: next, past, future: [], isDirty: true }
}

/** Creates a fresh block instance of `type` with its registered defaults. */
export function makeBlock(type: BlockType): BlockProps {
  const def = getBlockDef(type)
  if (!def) throw new Error(`Unknown block type: ${type}`)
  return {
    id: nanoid(),
    type,
    props: structuredClone(def.defaults),
  } as BlockProps
}

/** Deep-clones a block, assigning it a new id (fresh by default). */
export function cloneBlock(block: BlockProps, newId = nanoid()): BlockProps {
  return structuredClone({ ...block, id: newId })
}

/** Returns a copy of `arr` with `item` inserted after `afterId` (or appended). */
export function insertAt<T>(
  arr: T[],
  item: T,
  afterId: string | null | undefined,
  getId: (x: T) => string
): T[] {
  if (!afterId) return [...arr, item]
  const idx = arr.findIndex((x) => getId(x) === afterId)
  if (idx === -1) return [...arr, item]
  const next = [...arr]
  next.splice(idx + 1, 0, item)
  return next
}

/** Returns ids of `id` plus all descendants (children, grand-children…). */
export function descendantIds(blocks: BlockProps[], id: string): string[] {
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

/**
 * Editorial text keys. Find & replace only rewrites strings whose *parent object
 * key* is one of these — so we never mangle structural strings like `url`, `link`,
 * `src`, `icon`, `name`, etc. `html` is included on purpose: it's rich editorial
 * content. The walk still recurses through every object/array to reach nested text
 * keys (e.g. faq/tabs/repeater items carrying question/answer/label/content).
 */
export const TEXT_KEYS = [
  'text',
  'title',
  'subtitle',
  'description',
  'content',
  'quote',
  'caption',
  'label',
  'answer',
  'question',
  'html',
] as const
const TEXT_KEY_SET = new Set<string>(TEXT_KEYS)

/**
 * Recursively clones `value`, replacing every literal (non-regex), case-sensitive
 * occurrence of `find` with `replace` — but ONLY inside strings whose parent object
 * key is in {@link TEXT_KEYS}. Walks into arrays and plain objects to reach nested
 * text keys; leaves numbers/booleans/null/undefined untouched. `parentKey` is the
 * key of the object property currently being visited (undefined at the root and for
 * array elements, which inherit their array's key via the recursion).
 * Returns the (possibly new) value plus how many replacements were made so the
 * caller can avoid a history entry when nothing changed.
 */
export function deepReplaceText(
  value: unknown,
  find: string,
  replace: string,
  parentKey?: string
): { value: unknown; count: number } {
  if (typeof value === 'string') {
    // Only rewrite strings sitting under an editorial text key.
    if (parentKey === undefined || !TEXT_KEY_SET.has(parentKey)) {
      return { value, count: 0 }
    }
    if (!value.includes(find)) return { value, count: 0 }
    // split/join = literal replace of ALL occurrences (no regex interpretation of `find`).
    const occurrences = value.split(find).length - 1
    return { value: value.split(find).join(replace), count: occurrences }
  }
  if (Array.isArray(value)) {
    let count = 0
    let changed = false
    // Array elements inherit the array's key (parentKey) so e.g. a `text: string[]`
    // is rewritten, while elements that are objects/arrays recurse to their own keys.
    const next = value.map((item) => {
      const r = deepReplaceText(item, find, replace, parentKey)
      count += r.count
      if (r.count > 0) changed = true
      return r.value
    })
    return changed ? { value: next, count } : { value, count }
  }
  // Plain objects only — never touch class instances (e.g. Date) so we don't corrupt them.
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto === Object.prototype || proto === null) {
      let count = 0
      let changed = false
      const next: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const r = deepReplaceText(child, find, replace, key)
        count += r.count
        if (r.count > 0) changed = true
        next[key] = r.value
      }
      return changed ? { value: next, count } : { value, count }
    }
  }
  return { value, count: 0 }
}

// ── read-only lookups (public API, re-exported from store.ts) ─────────
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
