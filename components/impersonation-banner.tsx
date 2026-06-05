"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useAuthSession } from "@/components/auth-session-provider"
import { Button } from "@/components/ui/button"
import { EyeIcon } from "lucide-react"

/// Bannière persistante (sticky top) affichée tant que la session active est
/// une session d'impersonation (plugin admin Better Auth). Montée dans le
/// root layout (cf. app/layout.tsx) pour être visible partout — y compris
/// hors /admin, puisque l'admin perd l'accès au shell admin pendant qu'il
/// impersonifie un partner/employer/user.
///
/// "Revenir admin" appelle /api/admin/stop-impersonate puis recharge.
export function ImpersonationBanner() {
  const { data: session } = useAuthSession()
  const [stopping, setStopping] = useState(false)

  const impersonatedBy = (session?.session as { impersonatedBy?: string | null } | undefined)
    ?.impersonatedBy
  if (!session || !impersonatedBy) return null

  const stop = async () => {
    setStopping(true)
    try {
      const res = await fetch("/api/admin/stop-impersonate", { method: "POST" })
      if (!res.ok) {
        toast.error("Impossible de revenir admin")
        setStopping(false)
        return
      }
      // Reload pour que les Server Components voient à nouveau la session admin.
      window.location.href = "/admin"
    } catch {
      toast.error("Erreur réseau")
      setStopping(false)
    }
  }

  return (
    <div className="sticky top-0 z-[60] flex w-full items-center justify-center gap-3 border-b border-amber-300/60 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-100">
      <EyeIcon className="size-4 shrink-0" />
      <span className="truncate">
        Vous voyez le site comme <strong>{session.user.name || session.user.email}</strong>{" "}
        {session.user.email ? <span className="opacity-70">({session.user.email})</span> : null}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-700/40 bg-white/60 text-amber-900 hover:bg-white dark:border-amber-200/30 dark:bg-amber-900/40 dark:text-amber-50 dark:hover:bg-amber-900/70"
        onClick={stop}
        disabled={stopping}
      >
        {stopping ? "Retour…" : "Revenir admin"}
      </Button>
    </div>
  )
}
