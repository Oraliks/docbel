"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "docbel:formations:saved";

/**
 * Formations sauvegardées côté client (localStorage). Suffisant pour le visiteur
 * non connecté ; la synchro serveur (TrainingSaved) est ajoutée en Phase 5 pour
 * les utilisateurs connectés. Émet un event pour synchroniser les instances.
 */
export function useSavedFormations() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(KEY);
        setSaved(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        setSaved([]);
      }
    };
    read();
    window.addEventListener("docbel:formations:saved-change", read);
    return () => window.removeEventListener("docbel:formations:saved-change", read);
  }, []);

  const persist = useCallback((next: string[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    setSaved(next);
    window.dispatchEvent(new Event("docbel:formations:saved-change"));
  }, []);

  const isSaved = useCallback((slug: string) => saved.includes(slug), [saved]);

  const toggle = useCallback(
    (slug: string) => {
      persist(saved.includes(slug) ? saved.filter((s) => s !== slug) : [...saved, slug]);
    },
    [saved, persist],
  );

  return { saved, isSaved, toggle };
}
