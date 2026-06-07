"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/// Bouton "Forcer l'arrêt" pour une ligne d'audit d'impersonation en cours
/// (stoppedAt=null). POST /api/admin/impersonation/force-stop puis refresh
/// la page audit pour re-afficher la ligne fermée.
export function ForceStopButton({ logId }: { logId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (
      !window.confirm(
        "Forcer l'arrêt de cette session ? La cible sera déconnectée immédiatement."
      )
    ) {
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/admin/impersonation/force-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(err.error || "Force stop impossible")
        return
      }
      toast.success("Session terminée")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={run}
      disabled={busy}
      className="h-7 px-2 text-xs"
    >
      {busy ? "…" : "Forcer arrêt"}
    </Button>
  )
}
