'use client'

import { useCallback, useEffect, useState } from 'react'

/** Référence légère vers une entrée de lookup ONEM (table + code + libellé affichable). */
export interface LookupRef {
  tableSlug: string
  code: string
  label: string
}

/** Clé d'identité stable d'une référence (sert à la déduplication et aux comparaisons). */
export function refKey(r: LookupRef): string {
  return `${r.tableSlug}::${r.code}`
}

const FAVORITES_KEY = 'docbel-lookup-favorites'
const RECENTS_KEY = 'docbel-lookup-recents'
const RECENTS_MAX = 20

/** Lit et parse un tableau de LookupRef depuis localStorage (SSR-safe, tolérant aux données corrompues). */
function readLS(key: string): LookupRef[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Ne garde que les entrées bien formées.
    return parsed.filter(
      (item): item is LookupRef =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as LookupRef).tableSlug === 'string' &&
        typeof (item as LookupRef).code === 'string' &&
        typeof (item as LookupRef).label === 'string',
    )
  } catch {
    return []
  }
}

/** Sérialise un tableau de LookupRef dans localStorage (SSR-safe, ignore les erreurs de quota/mode privé). */
function writeLS(key: string, value: LookupRef[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore (mode privé, quota dépassé, etc.).
  }
}

/**
 * Gère favoris et entrées récentes du Lookup ONEM via localStorage.
 *
 * Zéro dépendance externe. SSR-safe : les states démarrent vides côté serveur
 * puis sont hydratés depuis localStorage au montage. Chaque mutation persiste
 * immédiatement.
 *
 * - Favoris : ensemble libre, bascule via `toggleFavorite`.
 * - Récents : max 20, le plus récent en premier, dédupliqués par `refKey`.
 */
export function useLookupFavorites() {
  // Démarre vide côté serveur (et au 1er rendu client) pour éviter tout
  // décalage d'hydratation, puis on hydrate dans l'effet ci-dessous.
  const [favorites, setFavorites] = useState<LookupRef[]>([])
  const [recents, setRecents] = useState<LookupRef[]>([])

  // Hydratation depuis localStorage au montage (client uniquement).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readLS(FAVORITES_KEY))
    setRecents(readLS(RECENTS_KEY))
  }, [])

  const isFavorite = useCallback(
    (tableSlug: string, code: string): boolean => {
      const key = `${tableSlug}::${code}`
      return favorites.some((f) => refKey(f) === key)
    },
    [favorites],
  )

  const toggleFavorite = useCallback((ref: LookupRef): void => {
    setFavorites((prev) => {
      const key = refKey(ref)
      const exists = prev.some((f) => refKey(f) === key)
      const next = exists
        ? prev.filter((f) => refKey(f) !== key)
        : [...prev, ref]
      writeLS(FAVORITES_KEY, next)
      return next
    })
  }, [])

  const pushRecent = useCallback((ref: LookupRef): void => {
    setRecents((prev) => {
      const key = refKey(ref)
      // Retire l'éventuelle occurrence existante, place la nouvelle en tête, tronque à RECENTS_MAX.
      const next = [ref, ...prev.filter((r) => refKey(r) !== key)].slice(
        0,
        RECENTS_MAX,
      )
      writeLS(RECENTS_KEY, next)
      return next
    })
  }, [])

  const clearRecents = useCallback((): void => {
    setRecents([])
    writeLS(RECENTS_KEY, [])
  }, [])

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    recents,
    pushRecent,
    clearRecents,
  }
}
