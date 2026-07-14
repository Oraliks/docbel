'use client'
import { useState, useEffect, useCallback } from 'react'

const KEY = 'docbel:bureaux:favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation SSR-safe depuis localStorage au montage (même motif que useToolFavorites/useLookupFavorites)
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]))
    } catch {
      /* localStorage indispo → favoris en mémoire seulement */
    }
  }, [])

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return { favorites, toggle }
}
