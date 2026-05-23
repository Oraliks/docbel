'use client'

import { useEffect, useState, useMemo } from 'react'
import type { ActiveBaremeAmount } from '@/lib/baremes/getActiveBaremeData'

export interface BaremeLookupParams {
  /** comparisonKey exact (priorité maximale). */
  key?: string
  /** Filtre catégorie. */
  category?: string
  /** Filtre code d'allocation (ex: "AA1"). */
  allocationCode?: string
  /** Filtre code de tranche salariale (ex: "MIN" ou "29"). */
  salaryCode?: string | number
  /** Filtre article de loi (string brute, ex: "art. 28, § 2"). */
  article?: string
}

export interface BaremeLookupState {
  /** Tableau des montants correspondants. Peut être vide. */
  amounts: ActiveBaremeAmount[]
  /** Premier amount, raccourci pour les cas "lookup unique". */
  amount: ActiveBaremeAmount | null
  /** Date de validité de la version publiée actuelle. */
  validFrom: Date | null
  /** Nom du fichier source ONEM. */
  fileName: string | null
  /** Chargement en cours. */
  isLoading: boolean
  /** Erreur si le fetch a échoué (réseau, 500). 404 = pas d'erreur, juste amounts vide. */
  error: Error | null
  /** Aucune version barème n'est publiée (404 attendu). */
  notPublished: boolean
  /** Force un re-fetch en ignorant le cache. */
  refresh: () => void
}

interface CacheEntry {
  data: LookupResponse
  fetchedAt: number
}

interface LookupResponse {
  fileId: string
  validFrom: string | null
  publishedAt: string | null
  fileName: string
  count: number
  amounts: ActiveBaremeAmount[]
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, CacheEntry>()

function paramsToQuery(p: BaremeLookupParams): string {
  const usp = new URLSearchParams()
  if (p.key) usp.set('key', p.key)
  if (p.category) usp.set('category', p.category)
  if (p.allocationCode) usp.set('allocationCode', p.allocationCode)
  if (p.salaryCode != null) usp.set('salaryCode', String(p.salaryCode))
  if (p.article) usp.set('article', p.article)
  return usp.toString()
}

/**
 * Hook React pour consulter les barèmes officiels publiés.
 *
 * Exemples :
 *
 *   // Lookup direct par comparisonKey
 *   const { amount } = useBareme({ key: "full_unemployment:AA1:MIN" })
 *
 *   // Lookup ciblé
 *   const { amount } = useBareme({
 *     category: "full_unemployment",
 *     allocationCode: "AA1",
 *     salaryCode: "MIN",
 *   })
 *
 *   // Toute une catégorie
 *   const { amounts } = useBareme({ category: "salary_bracket" })
 *
 * Caractéristiques :
 *  - Cache en mémoire 5 min par combinaison de paramètres
 *  - Loading state + error state séparés
 *  - notPublished = true si aucune version barème n'est publiée (cas valide)
 *  - refresh() invalide le cache et force un nouveau fetch
 */
export function useBareme(params: BaremeLookupParams): BaremeLookupState {
  const query = useMemo(() => paramsToQuery(params), [params])
  const url = useMemo(() => `/api/baremes/lookup?${query}`, [query])

  const [data, setData] = useState<LookupResponse | null>(() => {
    const cached = cache.get(query)
    return cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached.data : null
  })
  const [isLoading, setIsLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)
  const [notPublished, setNotPublished] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const cached = cache.get(query)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setData(cached.data)
      setIsLoading(false)
      setNotPublished(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setNotPublished(false)

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setNotPublished(true)
          setData(null)
          return
        }
        if (!res.ok) {
          throw new Error(`Lookup failed: HTTP ${res.status}`)
        }
        const json = (await res.json()) as LookupResponse
        cache.set(query, { data: json, fetchedAt: Date.now() })
        setData(json)
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
  }, [url, query, tick])

  const refresh = () => {
    cache.delete(query)
    setTick((t) => t + 1)
  }

  return {
    amounts: data?.amounts ?? [],
    amount: data?.amounts?.[0] ?? null,
    validFrom: data?.validFrom ? new Date(data.validFrom) : null,
    fileName: data?.fileName ?? null,
    isLoading,
    error,
    notPublished,
    refresh,
  }
}

/**
 * Invalide tout le cache local du hook. À appeler après une publication
 * dans l'admin si on a besoin d'un refresh immédiat.
 */
export function invalidateBaremeHookCache() {
  cache.clear()
}
