"use client";

import { useEffect, useRef, useState } from "react";

/// Résout un code postal belge (4 chiffres) vers sa/ses commune(s) via
/// `/api/postal-lookup` (données Commune/PostalCode déjà en base). État
/// purement LOCAL au composant (affichage d'un indice, jamais écrit dans le
/// state du formulaire) — pas de risque de setState-dans-useEffect sur le
/// state partagé du form-runner.
export function usePostalCommuneHint(postalCode: string): string | null {
  const [hint, setHint] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!/^\d{4}$/.test(postalCode)) {
      setHint(null);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = setTimeout(() => {
      fetch(`/api/postal-lookup?code=${postalCode}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (seq !== requestSeq.current) return;
          const communes: { nameFr: string }[] = data?.communes ?? [];
          setHint(communes.length > 0 ? communes.map((c) => c.nameFr).join(" / ") : null);
        })
        .catch(() => {
          if (seq === requestSeq.current) setHint(null);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [postalCode]);

  return hint;
}
