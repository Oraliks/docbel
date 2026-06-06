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
import { EyeIcon, EyeOffIcon, SearchIcon } from "lucide-react"
import { Input } from "@/components/ui/input"

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

  // Search vrais users (Phase D #7). Debouncé 300ms. Min 2 chars.
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<DemoAccount[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users-search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { users: DemoAccount[] }
        if (!cancelled) setSearchResults(data.users)
      } catch {
        // silencieux : on n'affiche pas d'erreur sur chaque keystroke
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

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
    // En prod, on exige une raison (>=10 chars) saisie par l'admin pour la
    // tracer dans l'audit log (cf. AdminImpersonationLog.reason, migration 39).
    // En dev, raison optionnelle — on n'embête pas le solo dev pour ses tests.
    let reason: string | null = null
    if (process.env.NODE_ENV === "production") {
      const input = window.prompt(
        `Raison de l'impersonation de ${ROLE_LABELS[account.role] || account.role} (${account.email}) ?\n\nMinimum 10 caractères. Sera tracée dans l'audit log.`
      )
      if (input === null) return // annulation
      reason = input.trim()
      if (reason.length < 10) {
        toast.error("Raison trop courte (10 caractères minimum)")
        return
      }
    }
    setPending(account.id)
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: account.id, reason }),
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
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Rechercher un user</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, nom ou organisation…"
              className="h-8 pl-7 text-sm"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          {query.trim().length >= 2 && (
            <div className="mt-1 max-h-56 overflow-auto rounded-md border bg-popover">
              {searching && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Recherche…
                </div>
              )}
              {!searching && searchResults.length === 0 && (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Aucun résultat
                </div>
              )}
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    void impersonate(user)
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
                >
                  <span className="text-sm font-medium">
                    {user.name || user.email}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({ROLE_LABELS[user.role] || user.role})
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user.partnerOrganization || user.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
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
