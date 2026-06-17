"use client";

import { useEffect, useState } from "react";

interface ModuleState {
  navVisible: boolean;
  access: string;
  loading: boolean;
}

/**
 * État du module Formations pour la navigation client. Tant que le fetch n'a
 * pas répondu, on considère `navVisible = true` (optimiste) pour éviter un
 * flash de masquage quand le module est actif (cas courant). Le contrôle
 * d'accès réel reste côté serveur sur chaque route.
 */
export function useFormationsModule(): ModuleState {
  const [state, setState] = useState<ModuleState>({ navVisible: true, access: "ok", loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/formations/module-state")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ navVisible: !!d.navVisible, access: d.access ?? "ok", loading: false });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
