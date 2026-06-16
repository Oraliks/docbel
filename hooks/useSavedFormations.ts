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
      const isOn = saved.includes(slug);
      persist(isOn ? saved.filter((s) => s !== slug) : [...saved, slug]);
      // Persiste côté serveur pour les utilisateurs connectés (no-op si anonyme).
      if (isOn) {
        void fetch(`/api/formations/saved?id=${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => {});
      } else {
        void fetch("/api/formations/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingId: slug }),
        }).catch(() => {});
      }
    },
    [saved, persist],
  );

  return { saved, isSaved, toggle };
}
