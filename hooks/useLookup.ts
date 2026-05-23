'use client'

import { useEffect, useState, useMemo } from 'react'
import type { ResolvedLookupEntry } from '@/lib/lookup/getLookupEntry'

export interface UseLookupParams {
  /** Slug de la table (ex: "s04-s36-article-indemnisation"). */
  tableSlug: string
  /** Code de l'entrée (ex: "27,2A1"). */
  code: string
}

export interface UseLookupState {
  entry: ResolvedLookupEntry | null
  isLoading: boolean
  error: Error | null
  notFound: boolean
  refresh: () => void
}

interface CacheEntry {
  data: ResolvedLookupEntry | null
  fetchedAt: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function cacheKey(p: UseLookupParams): string {
  return `${p.tableSlug}::${p.code}`
}

/**
 * Hook pour résoudre un code ONEM en libellés multi-langues + métadonnées.
 *
 * Cache mémoire 5 min par (table, code). Invalidate via `invalidateLookupHookCache()`.
 *
 * Exemples :
 *   const { entry } = useLookup({ tableSlug: 's01-sex', code: '1' })
 *   // entry.labelFr = "Masculin", entry.labelNl = "Man"
 *
 *   const { entry } = useLookup({ tableSlug: 's04-s36-article-indemnisation', code: '44' })
 *   // entry.labelFr = "Pas privé de travail et/ou rémunération"
 */
export function useLookup(params: UseLookupParams): UseLookupState {
  const key = cacheKey(params)
  const url = useMemo(
    () => `/api/lookup/resolve?tableSlug=${encodeURIComponent(params.tableSlug)}&code=${encodeURIComponent(params.code)}`,
    [params.tableSlug, params.code]
  )

  const [data, setData] = useState<ResolvedLookupEntry | null>(() => {
    const cached = cache.get(key)
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached.data : null
  })
  const [isLoading, setIsLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached.data)
      setIsLoading(false)
      setNotFound(cached.data === null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setNotFound(false)

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          cache.set(key, { data: null, fetchedAt: Date.now() })
          setData(null)
          setNotFound(true)
          return
        }
        if (!res.ok) throw new Error(`Lookup failed: HTTP ${res.status}`)
        const json = (await res.json()) as { entry: ResolvedLookupEntry | null }
        cache.set(key, { data: json.entry, fetchedAt: Date.now() })
        setData(json.entry)
        setNotFound(json.entry === null)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, key, tick])

  return {
    entry: data,
    isLoading,
    error,
    notFound,
    refresh: () => {
      cache.delete(key)
      setTick((t) => t + 1)
    },
  }
}

export function invalidateLookupHookCache() {
  cache.clear()
}
