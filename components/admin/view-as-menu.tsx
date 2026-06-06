"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EyeIcon, EyeOffIcon } from "lucide-react"

/// Liste des comptes demo récupérés depuis /api/admin/demo-accounts.
/// Forme intentionnellement réduite (UI uniquement).
type DemoAccount = {
  id: string
  email: string
  name: string
  role: string
  partnerOrganization: string | null
  segment: string | null
}

const ROLE_LABELS: Record<string, string> = {
  user: "Citoyen",
  partner: "Partenaire",
  employer: "Employeur",
}

/// Dropdown "Voir en tant que" intégré au SiteHeader admin. Liste les
/// comptes demo (cf. scripts/seed-demo-accounts.ts) et déclenche une
/// impersonation côté serveur, puis recharge la page pour que tous les
/// Server Components soient re-rendus avec la nouvelle session.
export function ViewAsMenu() {
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  // Lazy-fetch : on ne tape l'API qu'à la première ouverture du menu, pas
  // au mount, pour ne pas spammer /api sur chaque page du shell admin.
  const ensureLoaded = async () => {
    if (accounts !== null || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/demo-accounts", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as { accounts: DemoAccount[] }
      setAccounts(data.accounts)
    } catch {
      toast.error("Impossible de charger les comptes demo")
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }

  /// "Visiteur anonyme" : POST /api/admin/view-as-visitor — stash la session
  /// admin et déconnecte l'admin côté navigateur. Pas une vraie impersonation
  /// (Better Auth ne sait pas "impersonifier rien"), donc flow dédié.
  const goVisitor = async () => {
    setPending("__visitor__")
    try {
      const res = await fetch("/api/admin/view-as-visitor", { method: "POST" })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error.error || "Bascule visiteur impossible")
        return
      }
      window.location.href = "/"
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(null)
    }
  }

  const impersonate = async (account: DemoAccount) => {
    setPending(account.id)
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: account.id }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error.error || "Impersonation impossible")
        return
      }
      // Hard reload : Server Components et middlewares relisent la session.
      // Redirige vers / (l'admin perd l'accès à /admin sous impersonation).
      window.location.href = "/"
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void ensureLoaded()
            }}
          >
            <EyeIcon className="mr-1.5 size-4" />
            <span className="hidden sm:inline">Voir en tant que</span>
            <span className="sm:hidden">Voir</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Modes</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={pending !== null}
          onClick={(e) => {
            e.preventDefault()
            void goVisitor()
          }}
          className="flex flex-col items-start gap-0.5"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <EyeOffIcon className="size-3.5" />
            Visiteur anonyme
            {pending === "__visitor__" && (
              <span className="text-xs text-muted-foreground">…</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            Te déconnecte avec retour 1-clic en admin
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Comptes demo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">Chargement…</div>
        )}
        {!loading && accounts !== null && accounts.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Aucun compte demo. Lance{" "}
            <code className="font-mono text-[10px]">
              pnpm tsx scripts/seed-demo-accounts.ts
            </code>
            .
          </div>
        )}
        {!loading &&
          accounts !== null &&
          accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              disabled={pending !== null}
              onClick={(e) => {
                e.preventDefault()
                void impersonate(account)
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">
                {ROLE_LABELS[account.role] || account.role}
                {pending === account.id && (
                  <span className="ml-2 text-xs text-muted-foreground">…</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {account.partnerOrganization || account.email}
              </span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
