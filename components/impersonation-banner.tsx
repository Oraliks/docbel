"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuthSession } from "@/components/auth-session-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ChevronDownIcon, EyeIcon, LockIcon, UnlockIcon } from "lucide-react"

/// Durée d'une session d'impersonation (cf. impersonationSessionDuration dans
/// lib/auth.ts). Si tu la changes là-bas, change-la ici aussi.
const IMPERSONATION_SESSION_SECONDS = 60 * 60

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

/// Schéma de couleur par rôle impersonifié. On reste dans le ton mauve/violet
/// du design system docbel pour les partenaires (rôle "natif" du SI), bleu
/// pour les employeurs, teal/vert pour les citoyens. Tout passe par des
/// classes Tailwind plutôt que du hardcoded hex pour rester aligné avec le
/// dark mode et les tokens.
const ROLE_THEME: Record<
  string,
  { wrap: string; button: string }
> = {
  partner: {
    wrap: "border-violet-300/60 bg-violet-100 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/70 dark:text-violet-100",
    button:
      "border-violet-700/40 bg-white/60 text-violet-900 hover:bg-white dark:border-violet-200/30 dark:bg-violet-900/40 dark:text-violet-50 dark:hover:bg-violet-900/70",
  },
  employer: {
    wrap: "border-sky-300/60 bg-sky-100 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/70 dark:text-sky-100",
    button:
      "border-sky-700/40 bg-white/60 text-sky-900 hover:bg-white dark:border-sky-200/30 dark:bg-sky-900/40 dark:text-sky-50 dark:hover:bg-sky-900/70",
  },
  user: {
    wrap: "border-emerald-300/60 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/70 dark:text-emerald-100",
    button:
      "border-emerald-700/40 bg-white/60 text-emerald-900 hover:bg-white dark:border-emerald-200/30 dark:bg-emerald-900/40 dark:text-emerald-50 dark:hover:bg-emerald-900/70",
  },
}

const FALLBACK_THEME = {
  wrap: "border-amber-300/60 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/70 dark:text-amber-100",
  button:
    "border-amber-700/40 bg-white/60 text-amber-900 hover:bg-white dark:border-amber-200/30 dark:bg-amber-900/40 dark:text-amber-50 dark:hover:bg-amber-900/70",
}

/// Thème neutre pour le mode "visiteur anonyme" (admin déconnecté, retour
/// 1-clic via /api/admin/restore-admin). Gris pour ne pas alarmer.
const VISITOR_THEME = {
  wrap: "border-slate-300/60 bg-slate-100 text-slate-900 dark:border-slate-500/40 dark:bg-slate-900/70 dark:text-slate-100",
  button:
    "border-slate-700/40 bg-white/60 text-slate-900 hover:bg-white dark:border-slate-200/30 dark:bg-slate-800/40 dark:text-slate-50 dark:hover:bg-slate-800/70",
}

/// Lit côté client le cookie marqueur posé par /api/admin/view-as-visitor.
/// Pas HttpOnly côté serveur (cf. lib/admin/stash-cookie.ts) pour que cette
/// lecture soit possible sans round-trip.
function readVisitorMarker(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith("docbel_view_as_visitor=1"))
}

/// Lit le cookie de préférence lecture seule (cf. lib/admin/readonly-guard.ts).
/// Renvoie null si pas posé → l'appelant applique le default selon NODE_ENV.
function readReadOnlyCookie(): boolean | null {
  if (typeof document === "undefined") return null
  const entry = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("docbel_impersonation_readonly="))
  if (!entry) return null
  const value = entry.split("=")[1]
  if (value === "1") return true
  if (value === "0") return false
  return null
}

/// Convertit le nombre de secondes restantes en chaîne courte ("42 min",
/// "8 min", "expire bientôt"). Volontairement sobre, on évite le tic-tac
/// anxiogène à la seconde près.
function formatRemaining(secondsLeft: number): string {
  if (secondsLeft <= 0) return "expirée"
  if (secondsLeft < 60) return "expire bientôt"
  const minutes = Math.floor(secondsLeft / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem.toString().padStart(2, "0")}` : `${hours}h`
}

function formatStartTime(date: Date): string {
  return date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
}

/// Bannière persistante (sticky top) montée dans app/layout.tsx. Affichée
/// uniquement si la session active est une impersonation (session.impersonatedBy
/// non null).
///
/// Comporte :
///   - le rôle impersonifié + nom du target (couleur dédiée par rôle)
///   - le compte à rebours avant expiration (1h) avec tooltip "Depuis HH:MM"
///   - un switcher "Voir comme ▾" pour basculer entre les comptes demo sans
///     repasser par le shell admin (enchaîne stop + impersonate côté client)
///   - le bouton "Revenir admin"
export function ImpersonationBanner() {
  const { data: session } = useAuthSession()
  const [stopping, setStopping] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<DemoAccount[] | null>(null)
  const [now, setNow] = useState<number>(() =>
    typeof window === "undefined" ? 0 : Date.now()
  )

  const impersonatedBy = (
    session?.session as { impersonatedBy?: string | null } | undefined
  )?.impersonatedBy
  const isImpersonating = Boolean(session && impersonatedBy)

  // Mode visiteur anonyme : pas de session côté client, mais cookie marqueur
  // posé par /api/admin/view-as-visitor. On le lit au mount uniquement (pas
  // de polling, ça change rarement).
  const [isVisitor, setIsVisitor] = useState(false)
  useEffect(() => {
    if (session) return
    setIsVisitor(readVisitorMarker())
  }, [session])

  // Toggle lecture seule (Phase C #8). Etat initial = cookie posé, sinon
  // default selon NODE_ENV (ON en prod, OFF en dev). Lu au mount uniquement.
  const [readOnly, setReadOnly] = useState(false)
  const [togglingRO, setTogglingRO] = useState(false)
  useEffect(() => {
    if (!isImpersonating) return
    const cookie = readReadOnlyCookie()
    setReadOnly(cookie ?? process.env.NODE_ENV === "production")
  }, [isImpersonating])

  // Tick toutes les 30s pour mettre à jour le countdown sans surconsommer.
  useEffect(() => {
    if (!isImpersonating) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isImpersonating])

  // Lazy-fetch des comptes demo à la 1ère ouverture du switcher.
  const ensureAccounts = async () => {
    if (accounts !== null) return
    try {
      const res = await fetch("/api/admin/demo-accounts", { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as { accounts: DemoAccount[] }
      setAccounts(data.accounts)
    } catch {
      toast.error("Impossible de charger les comptes demo")
      setAccounts([])
    }
  }

  const startDate = useMemo(() => {
    const raw = (session?.session as { createdAt?: string | Date } | undefined)?.createdAt
    if (!raw) return null
    const d = raw instanceof Date ? raw : new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }, [session])

  const secondsLeft = useMemo(() => {
    if (!startDate || !now) return null
    const elapsed = Math.floor((now - startDate.getTime()) / 1000)
    return IMPERSONATION_SESSION_SECONDS - elapsed
  }, [startDate, now])

  /// Branche dédiée au mode visiteur anonyme (session=null + cookie marqueur).
  /// UI plus minimale : pas de countdown (le stash dure 1h max mais la session
  /// admin elle-même est valide 30j), pas de switcher (on ne peut pas
  /// impersonifier sans session admin active).
  if (!session && isVisitor) {
    const restore = async () => {
      setStopping(true)
      try {
        const res = await fetch("/api/admin/restore-admin", { method: "POST" })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          toast.error(err.error || "Impossible de restaurer la session admin")
          setStopping(false)
          return
        }
        window.location.href = "/admin"
      } catch {
        toast.error("Erreur réseau")
        setStopping(false)
      }
    }
    return (
      <div
        className={`sticky top-0 z-[60] flex w-full items-center justify-center gap-3 border-b px-4 py-2 text-sm ${VISITOR_THEME.wrap}`}
      >
        <EyeIcon className="size-4 shrink-0" />
        <span className="truncate">
          Vous voyez le site en <strong>visiteur anonyme</strong>
        </span>
        <Button
          size="sm"
          variant="outline"
          className={`shrink-0 ${VISITOR_THEME.button}`}
          onClick={restore}
          disabled={stopping}
        >
          {stopping ? "Retour…" : "Revenir admin"}
        </Button>
      </div>
    )
  }

  if (!session || !impersonatedBy) return null

  const role = session.user.role || "user"
  const theme = ROLE_THEME[role] ?? FALLBACK_THEME
  const roleLabel = ROLE_LABELS[role] || role

  const stop = async () => {
    setStopping(true)
    try {
      const res = await fetch("/api/admin/stop-impersonate", { method: "POST" })
      if (!res.ok) {
        toast.error("Impossible de revenir admin")
        setStopping(false)
        return
      }
      window.location.href = "/admin"
    } catch {
      toast.error("Erreur réseau")
      setStopping(false)
    }
  }

  const toggleReadOnly = async () => {
    const next = !readOnly
    setTogglingRO(true)
    try {
      const res = await fetch("/api/admin/impersonation-readonly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) {
        toast.error("Bascule lecture/écriture impossible")
        return
      }
      setReadOnly(next)
      toast.success(next ? "Lecture seule activée" : "Écriture autorisée")
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setTogglingRO(false)
    }
  }

  /// Switcher : stop l'impersonation courante puis lance une nouvelle
  /// impersonation. Enchaîné côté client en 2 requêtes parce que Better Auth
  /// admin plugin exige une session admin pour appeler impersonateUser, et
  /// celle-ci n'est récupérée qu'après le stop. Si la 2ème échoue, l'admin
  /// se retrouve simplement déconnecté de l'impersonation (état cohérent),
  /// et le shell admin redevient accessible.
  const switchTo = async (target: DemoAccount) => {
    if (target.id === session.user.id) return
    setSwitching(target.id)
    try {
      const stopRes = await fetch("/api/admin/stop-impersonate", { method: "POST" })
      if (!stopRes.ok) {
        toast.error("Bascule impossible")
        setSwitching(null)
        return
      }
      const impRes = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      })
      if (!impRes.ok) {
        const error = (await impRes.json().catch(() => ({}))) as { error?: string }
        toast.error(error.error || "Bascule impossible")
        // Pas de rollback : on est de retour en admin, l'UI va recharger
        // proprement vers /admin et l'utilisateur peut retenter via le menu.
        window.location.href = "/admin"
        return
      }
      window.location.href = "/"
    } catch {
      toast.error("Erreur réseau")
      setSwitching(null)
    }
  }

  return (
    <div
      className={`sticky top-0 z-[60] flex w-full items-center justify-center gap-3 border-b px-4 py-2 text-sm ${theme.wrap}`}
    >
      <EyeIcon className="size-4 shrink-0" />
      <span className="truncate">
        Vous voyez le site comme <strong>{session.user.name || session.user.email}</strong>{" "}
        <span className="opacity-70">
          ({roleLabel}
          {session.user.email ? ` · ${session.user.email}` : ""})
        </span>
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="hidden shrink-0 rounded-full bg-white/40 px-2 py-0.5 font-mono text-xs tabular-nums sm:inline-flex dark:bg-black/20">
                {secondsLeft === null ? "—" : formatRemaining(secondsLeft)}
              </span>
            }
          />
          <TooltipContent side="bottom">
            {startDate
              ? `Démarrée à ${formatStartTime(startDate)} · expire après 1h`
              : "Session d'impersonation"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className={`shrink-0 ${theme.button}`}
                onClick={toggleReadOnly}
                disabled={togglingRO}
                aria-label={readOnly ? "Désactiver la lecture seule" : "Activer la lecture seule"}
              >
                {readOnly ? <LockIcon className="size-4" /> : <UnlockIcon className="size-4" />}
              </Button>
            }
          />
          <TooltipContent side="bottom">
            {readOnly
              ? "Lecture seule active — clic pour autoriser l'écriture"
              : "Écriture autorisée — clic pour passer en lecture seule"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              className={`shrink-0 ${theme.button}`}
              onClick={() => {
                void ensureAccounts()
              }}
              disabled={switching !== null}
            >
              Voir comme
              <ChevronDownIcon className="ml-1 size-3.5" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Basculer vers</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts === null && (
            <div className="px-2 py-3 text-xs text-muted-foreground">Chargement…</div>
          )}
          {accounts !== null &&
            accounts
              .filter((a) => a.id !== session.user.id)
              .map((account) => (
                <DropdownMenuItem
                  key={account.id}
                  disabled={switching !== null}
                  onClick={(e) => {
                    e.preventDefault()
                    void switchTo(account)
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">
                    {ROLE_LABELS[account.role] || account.role}
                    {switching === account.id && (
                      <span className="ml-2 text-xs text-muted-foreground">…</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {account.partnerOrganization || account.email}
                  </span>
                </DropdownMenuItem>
              ))}
          {accounts !== null &&
            accounts.filter((a) => a.id !== session.user.id).length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                Pas d&apos;autre compte demo disponible.
              </div>
            )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="outline"
        className={`shrink-0 ${theme.button}`}
        onClick={stop}
        disabled={stopping || switching !== null}
      >
        {stopping ? "Retour…" : "Revenir admin"}
      </Button>
    </div>
  )
}
