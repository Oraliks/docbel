"use client";

import { useEffect, useState } from "react";

/**
 * Hook client qui retourne le Set des slugs d'outils désactivés en DB.
 * Charge une fois au mount via /api/tools/active. Utilisé sur les surfaces
 * UI client-side (homepage, command palette) pour filtrer TOOLS_DATA et ne
 * pas afficher comme fonctionnels des outils mis en pause par l'admin.
 *
 * Tant que la réponse n'est pas reçue : Set vide → on affiche tout (mieux
 * vaut un flash de fantôme qu'un écran vide).
 */
export function useInactiveTools(): Set<string> {
  const [inactive, setInactive] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tools/active");
        if (!res.ok) return;
        const data = (await res.json()) as { inactive?: string[] };
        if (cancelled) return;
        setInactive(new Set(data.inactive ?? []));
      } catch {
        // silencieux : fail-open
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return inactive;
}
