"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import type { StoredCorrection } from "@/lib/documents/ocr-corrections";

/// Charge la mémoire OCR du template au mount, et expose une méthode pour
/// l'enrichir localement (optimistic update) après chaque annotation validée.
///
/// Le `findBestCorrection` se fait côté client dans le popover via cette liste,
/// donc pas d'aller-retour réseau à chaque clic.
export function useOcrCorrections(templateId: string) {
  const [corrections, setCorrections] = useState<StoredCorrection[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/ocr/corrections?templateId=${templateId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) setCorrections(data);
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  /// Ajoute une correction "optimistic" : utile pour que les clics suivants
  /// dans la même session bénéficient immédiatement de l'apprentissage, sans
  /// attendre que le serveur ait persisté.
  const appendOptimistic = useCallback(
    (entry: Omit<StoredCorrection, "id" | "occurrences"> & {
      occurrences?: number;
    }) => {
      const optimistic: StoredCorrection = {
        id: `local-${nanoid(4)}`,
        occurrences: 1,
        ...entry,
      };
      setCorrections((prev) => [optimistic, ...prev]);
    },
    []
  );

  return { corrections, appendOptimistic };
}
