// =====================================================================
//  Snippets — saved blocks that can be reused across pages.
//  Persisted in the database (model `Snippet`) and exposed through the
//  `/api/page-builder/snippets` endpoints. All accessors are async fetch
//  wrappers so callers must `await` them.
// =====================================================================

import type { BlockProps } from './types'
import { nanoid } from 'nanoid'

export interface Snippet {
  id: string
  name: string
  description?: string | null
  block: BlockProps
  createdAt: string
}

const BASE = '/api/page-builder/snippets'

/** Fetch all saved snippets (most recent first). */
export async function listSnippets(): Promise<Snippet[]> {
  const res = await fetch(BASE, { method: 'GET' })
  if (!res.ok) {
    throw new Error('Impossible de charger les snippets')
  }
  const data = await res.json()
  return Array.isArray(data.items) ? (data.items as Snippet[]) : []
}

/** Persist a block as a reusable snippet. */
export async function saveSnippet(
  name: string,
  block: BlockProps,
  description?: string
): Promise<Snippet> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, block }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || "Échec de l'enregistrement du snippet")
  }
  return (await res.json()) as Snippet
}

/** Delete a snippet by id. */
export async function deleteSnippet(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error || 'Échec de la suppression du snippet')
  }
}

/** Clone a snippet's block with a fresh id (so it can be inserted into a page). */
export function cloneSnippetBlock(snippet: Snippet): BlockProps {
  return { ...structuredClone(snippet.block), id: nanoid() }
}
