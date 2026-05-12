"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useVersionCheck } from "@/hooks/useVersionCheck";

export function VersionWatcher() {
  const handleNewVersion = useCallback(() => {
    toast.info("Nouvelle version disponible", {
      description: "Rechargez la page pour profiter des dernières améliorations.",
      duration: Infinity,
      action: {
        label: "Recharger",
        onClick: () => window.location.reload(),
      },
    });
  }, []);

  useVersionCheck(handleNewVersion);
  return null;
}
