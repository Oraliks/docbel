// =====================================================================
//  Snippets — saved blocks that can be reused across pages.
//  Stored in LocalStorage under "docbel.snippets" for now.
// =====================================================================

import type { BlockProps } from './types'
import { nanoid } from 'nanoid'

const STORAGE_KEY = 'docbel.snippets.v1'

export interface Snippet {
  id: string
  name: string
  description?: string
  block: BlockProps
  createdAt: string
}

export function listSnippets(): Snippet[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSnippet(name: string, block: BlockProps, description?: string): Snippet {
  const all = listSnippets()
  const snippet: Snippet = {
    id: nanoid(),
    name,
    description,
    block: structuredClone(block),
    createdAt: new Date().toISOString(),
  }
  all.unshift(snippet)
  // keep last 50
  const trimmed = all.slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  return snippet
}

export function deleteSnippet(id: string): void {
  const all = listSnippets().filter((s) => s.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

/** Clone a snippet's block with fresh IDs (so it can be inserted into a page). */
export function cloneSnippetBlock(snippet: Snippet): BlockProps {
  return { ...structuredClone(snippet.block), id: nanoid() }
}
