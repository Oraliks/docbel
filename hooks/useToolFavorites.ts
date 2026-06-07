"use client";

import { useCallback, useEffect, useState } from "react";

const FAVORITES_KEY = "docbel-tool-favorites";
const RECENTS_KEY = "docbel-tool-recents";
const RECENTS_MAX = 12;

/** Lit un tableau de slugs depuis localStorage (SSR-safe, tolérant aux données corrompues). */
function readLS(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Sérialise un tableau de slugs (SSR-safe, ignore quota/mode privé). */
function writeLS(key: string, value: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore (mode privé, quota dépassé, etc.).
  }
}

/**
 * Favoris + outils récemment ouverts, par slug, via localStorage.
 *
 * Les citoyens n'ont pas de compte (cf. modèle User) → pas de backend favoris :
 * on persiste côté client, comme `useLookupFavorites`. SSR-safe (states vides
 * au 1er rendu puis hydratés au montage ; `hydrated` permet d'éviter un flash
 * d'état vide sur les sections personnelles).
 */
export function useToolFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(readLS(FAVORITES_KEY));
    setRecents(readLS(RECENTS_KEY));
    setHydrated(true);
  }, []);

  const isFavorite = useCallback(
    (slug: string) => favorites.includes(slug),
    [favorites],
  );

  const toggleFavorite = useCallback((slug: string) => {
    setFavorites((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      writeLS(FAVORITES_KEY, next);
      return next;
    });
  }, []);

  const pushRecent = useCallback((slug: string) => {
    setRecents((prev) => {
      const next = [slug, ...prev.filter((s) => s !== slug)].slice(0, RECENTS_MAX);
      writeLS(RECENTS_KEY, next);
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    writeLS(RECENTS_KEY, []);
  }, []);

  return {
    favorites,
    recents,
    isFavorite,
    toggleFavorite,
    pushRecent,
    clearRecents,
    hydrated,
  };
}
