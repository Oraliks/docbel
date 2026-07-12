import { describe, it, expect } from 'vitest'
import {
  HISTORY_LIMIT,
  pushHistory,
  insertAt,
  descendantIds,
  deepReplaceText,
  cloneBlock,
} from '../store-helpers'
import type { BlockProps } from '../types'

function tb(id: string, parentId?: string | null): BlockProps {
  return { id, type: 'text', props: {}, parentId: parentId ?? null } as unknown as BlockProps
}

describe('insertAt', () => {
  const get = (x: { id: string }) => x.id
  it('appends when afterId is null/absent', () => {
    expect(insertAt([{ id: 'a' }], { id: 'b' }, null, get)).toEqual([{ id: 'a' }, { id: 'b' }])
  })
  it('inserts right after the target', () => {
    expect(insertAt([{ id: 'a' }, { id: 'c' }], { id: 'b' }, 'a', get)).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ])
  })
  it('appends when afterId is not found', () => {
    expect(insertAt([{ id: 'a' }], { id: 'b' }, 'zzz', get)).toEqual([{ id: 'a' }, { id: 'b' }])
  })
  it('does not mutate the input array', () => {
    const src = [{ id: 'a' }]
    insertAt(src, { id: 'b' }, null, get)
    expect(src).toEqual([{ id: 'a' }])
  })
})

describe('descendantIds', () => {
  it('returns the node plus all transitive children', () => {
    const blocks = [tb('root'), tb('c1', 'root'), tb('c2', 'root'), tb('g1', 'c1')]
    expect(descendantIds(blocks, 'root').sort()).toEqual(['c1', 'c2', 'g1', 'root'])
  })
  it('returns just the id when it has no children', () => {
    expect(descendantIds([tb('solo')], 'solo')).toEqual(['solo'])
  })
})

describe('pushHistory', () => {
  it('snapshots current blocks, sets next, clears future, marks dirty', () => {
    const cur = [tb('a')]
    const next = [tb('a'), tb('b')]
    const patch = pushHistory({ blocks: cur, past: [] }, next)
    expect(patch.blocks).toBe(next)
    expect(patch.past).toEqual([{ blocks: cur }])
    expect(patch.future).toEqual([])
    expect(patch.isDirty).toBe(true)
  })
  it('caps the past stack at HISTORY_LIMIT (drops the oldest)', () => {
    const past = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({ blocks: [tb(`old${i}`)] }))
    const patch = pushHistory({ blocks: [tb('cur')], past }, [tb('new')])
    expect(patch.past.length).toBe(HISTORY_LIMIT)
    // oldest ('old0') dropped, current appended at the end
    expect(patch.past[0].blocks[0].id).toBe('old1')
    expect(patch.past[patch.past.length - 1].blocks[0].id).toBe('cur')
  })
})

describe('deepReplaceText', () => {
  it('rewrites only editorial keys, counts occurrences', () => {
    const r = deepReplaceText({ text: 'a a a', url: 'a.be' }, 'a', 'b')
    expect(r.count).toBe(3)
    expect(r.value).toEqual({ text: 'b b b', url: 'a.be' })
  })
  it('recurses into nested arrays/objects under editorial keys', () => {
    const r = deepReplaceText({ items: [{ question: 'X?', link: 'X' }] }, 'X', 'Y')
    expect(r.count).toBe(1)
    expect((r.value as { items: Array<Record<string, string>> }).items[0]).toEqual({
      question: 'Y?',
      link: 'X',
    })
  })
  it('is a no-op (count 0, same ref) when nothing matches', () => {
    const input = { text: 'hello' }
    const r = deepReplaceText(input, 'zzz', 'y')
    expect(r.count).toBe(0)
    expect(r.value).toBe(input)
  })
})

describe('cloneBlock', () => {
  it('deep-clones and assigns a fresh id by default', () => {
    const src = tb('src')
    const clone = cloneBlock(src)
    expect(clone.id).not.toBe('src')
    expect(clone).not.toBe(src)
  })
  it('honours an explicit new id', () => {
    expect(cloneBlock(tb('src'), 'fixed').id).toBe('fixed')
  })
})
