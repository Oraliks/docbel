import type { BaremeDiffChangeType } from './types'

/** Une seule sérialisation pour le tableau et son export filtré. */
export function comparisonFilterParams(filters: { state?: BaremeDiffChangeType | ''; q?: string; sheet?: string; category?: string }): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of ['state', 'q', 'sheet', 'category'] as const) {
    const value = filters[key]?.trim()
    if (value) params.set(key, value)
  }
  return params
}
