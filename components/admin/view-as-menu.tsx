"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import {
  ImpersonationReasonDialog,
  type ImpersonationTarget,
} from "@/components/admin/impersonation-reason-dialog"

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
  const router = useRouter()
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<string | null>(null)

  // Search vrais users (Phase D #7). Debouncé 300ms. Min 2 chars.
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<DemoAccount[]>([])
  const [searching, setSearching] = useState(false)

  // MRU "Récemment vu comme" (#6). Lazy-fetch comme accounts.
  const [recent, setRecent] = useState<DemoAccount[] | null>(null)
  const ensureRecent = async () => {
    if (recent !== null) return
    try {
      const res = await fetch("/api/admin/recent-impersonations", {
        cache: "no-store",
      })
      if (!res.ok) {
        setRecent([])
        return
      }
      const data = (await res.json()) as { recent: DemoAccount[] }
      setRecent(data.recent)
    } catch {
      setRecent([])
    }
  }
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

  /// "Visiteur anonyme" : ouvre toujours le dialog de confirmation (#7) —
  /// en prod la raison est obligatoire (>=10 chars), en dev elle est
  /// facultative mais la confirmation explicite évite les clics accidentels.
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false)

  /// Exécution effective du basculement visiteur. POST /api/admin/view-as-visitor
  /// stash la session admin et déconnecte côté navigateur (la session DB reste
  /// vivante pour le restore 1-clic).
  const runVisitor = async (reason: string | null) => {
    setPending("__visitor__")
    try {
      const res = await fetch("/api/admin/view-as-visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error.error || "Bascule visiteur impossible")
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(null)
    }
  }

  const goVisitor = () => {
    setVisitorDialogOpen(true)
  }

  // En prod, on passe par un dialog shadcn pour saisir la raison
  // (cf. AdminImpersonationLog.reason, migration 39) au lieu du window.prompt
  // d'origine. En dev, l'impersonation est immédiate — on n'embête pas le
  // solo dev pour ses tests.
  const [reasonTarget, setReasonTarget] = useState<ImpersonationTarget | null>(
    null
  )

  const runImpersonate = async (
    account: ImpersonationTarget,
    reason: string | null
  ) => {
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
      // Navigation soft (#12) : router.refresh() force le re-fetch des
      // Server Components qui lisent getServerAuthSession() (root layout,
      // shell). Redirige vers / (l'admin perd l'accès à /admin sous impersonation).
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(null)
    }
  }

  const impersonate = async (account: DemoAccount) => {
    if (process.env.NODE_ENV === "production") {
      setReasonTarget(account)
      return
    }
    await runImpersonate(account, null)
  }

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void ensureLoaded()
              void ensureRecent()
            }}
          >
            <EyeIcon className="mr-1.5 size-4" />
            <span className="hidden sm:inline">Voir en tant que</span>
            <span className="sm:hidden">Voir</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        {recent !== null && recent.length > 0 && (
          <>
            <DropdownMenuLabel>Récemment vu comme</DropdownMenuLabel>
            {recent.map((account) => (
              <DropdownMenuItem
                key={`recent_${account.id}`}
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
            <DropdownMenuSeparator />
          </>
        )}
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

      <ImpersonationReasonDialog
        target={reasonTarget}
        onOpenChange={(open) => {
          if (!open) setReasonTarget(null)
        }}
        onConfirm={async (reason) => {
          const target = reasonTarget
          if (!target) return
          // On laisse le dialog visible (submitting) pendant le fetch ;
          // runImpersonate redirige via window.location à la réussite, ce qui
          // remplace le rendu. En cas d'erreur, on ferme manuellement.
          await runImpersonate(target, reason)
          setReasonTarget(null)
        }}
      />

      <ImpersonationReasonDialog
        target={null}
        visitorMode={visitorDialogOpen}
        // Dev : raison facultative (confirm simple) ; prod : >=10 chars
        // requis comme pour l'impersonation classique.
        reasonOptional={process.env.NODE_ENV !== "production"}
        onOpenChange={(open) => {
          if (!open) setVisitorDialogOpen(false)
        }}
        onConfirm={async (reason) => {
          await runVisitor(reason || null)
          setVisitorDialogOpen(false)
        }}
      />
    </>
  )
}
