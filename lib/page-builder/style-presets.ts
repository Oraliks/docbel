// Named, reusable style presets (style + layout), stored in localStorage.
// Lightweight by design — no DB, per-browser. Applied via store.applyStyle.
import type { BlockStyle, BlockLayout } from './types'

export interface StylePreset {
  id: string
  name: string
  style?: BlockStyle
  layout?: BlockLayout
}

const KEY = 'beldoc:style-presets'

export function listStylePresets(): StylePreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveStylePreset(
  name: string,
  payload: Pick<StylePreset, 'style' | 'layout'>
): StylePreset {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sp_${listStylePresets().length}_${name}`
  const preset: StylePreset = { id, name, style: payload.style, layout: payload.layout }
  // Replace any existing preset with the same name, keep newest first, cap 50.
  const next = [preset, ...listStylePresets().filter((p) => p.name !== name)].slice(0, 50)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // quota / unavailable — ignore
  }
  return preset
}

export function deleteStylePreset(id: string): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(listStylePresets().filter((p) => p.id !== id))
    )
  } catch {
    // ignore
  }
}
