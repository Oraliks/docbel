"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  LockKeyhole,
  MailCheck,
  Monitor,
  ShieldCheck,
  Unlock,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import type { User360, UserSecurity } from "@/lib/admin/user-360"
import { isBanActive } from "@/lib/admin/user-flags"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  IMPERSONATION_READ_ONLY_REASON,
  useImpersonationReadOnly,
} from "@/components/admin/use-impersonation-read-only"
import { formatDateTime } from "@/components/admin/users/user-detail-shell"

/// Abrège un user-agent en "Navigateur · OS" lisible (heuristique simple).
function shortUserAgent(ua: string | null): string {
  if (!ua) return "Client inconnu"
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Navigateur"
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : ""
  return os ? `${browser} · ${os}` : browser
}

interface UserSecurityTabProps {
  userId: string
  user: User360["user"]
  security: UserSecurity
}

export function UserSecurityTab({ userId, user, security }: UserSecurityTabProps) {
  const router = useRouter()
  const readOnly = useImpersonationReadOnly()
  const [pending, setPending] = useState<string | null>(null)
  const [banOpen, setBanOpen] = useState(false)
  const [banReason, setBanReason] = useState("")
  const [banExpires, setBanExpires] = useState("")

  const banned = isBanActive(user.banned, user.banExpires)
  const emailVerified = user.emailVerified || !!user.emailVerifiedAt
  const isLocked =
    !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()
  const canUnlock = isLocked || user.failedLoginAttempts > 0

  async function runAction(action: "unlock" | "verify-email", key: string) {
    setPending(key)
    try {
      const res = await fetch(`/api/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(error.error || "Action impossible")
      }
      toast.success(
        action === "unlock" ? "Compte déverrouillé" : "Email marqué comme vérifié",
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setPending(null)
    }
  }

  async function revoke(sessionId: string | null, key: string) {
    setPending(key)
    try {
      const url = sessionId
        ? `/api/users/${userId}/sessions?sessionId=${encodeURIComponent(sessionId)}`
        : `/api/users/${userId}/sessions`
      const res = await fetch(url, { method: "DELETE" })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(error.error || "Révocation impossible")
      }
      const data = (await res.json()) as { revoked: number }
      toast.success(
        data.revoked > 1
          ? `${data.revoked} sessions révoquées`
          : "Session révoquée",
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setPending(null)
    }
  }

  async function runBan() {
    if (banReason.trim().length < 3) {
      toast.error("Indiquez une raison de bannissement.")
      return
    }
    setPending("ban")
    try {
      const res = await fetch(`/api/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban",
          reason: banReason.trim(),
          expiresAt: banExpires ? new Date(banExpires).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(error.error || "Bannissement impossible")
      }
      toast.success("Compte banni (sessions révoquées)")
      setBanOpen(false)
      setBanReason("")
      setBanExpires("")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setPending(null)
    }
  }

  async function runUnban() {
    setPending("unban")
    try {
      const res = await fetch(`/api/users/${userId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unban" }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(error.error || "Débannissement impossible")
      }
      toast.success("Compte débanni")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Résumé sécurité */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4">
          <SecCell
            label="Mot de passe changé"
            value={formatDateTime(user.passwordChangedAt)}
            icon={KeyRound}
          />
          <SecCell
            label="Tentatives échouées"
            value={String(user.failedLoginAttempts)}
            icon={ShieldCheck}
            tone={user.failedLoginAttempts > 0 ? "warn" : undefined}
          />
          <SecCell
            label="Verrouillage"
            value={isLocked ? `jusqu'au ${formatDateTime(user.lockedUntil)}` : "Aucun"}
            icon={LockKeyhole}
            tone={isLocked ? "warn" : undefined}
          />
          <SecCell
            label="Email vérifié"
            value={emailVerified ? formatDateTime(user.emailVerifiedAt) || "Oui" : "Non"}
            icon={MailCheck}
            tone={emailVerified ? undefined : "warn"}
          />
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          <GatedButton
            readOnly={readOnly}
            disabled={!canUnlock || pending !== null}
            loading={pending === "unlock"}
            onClick={() => runAction("unlock", "unlock")}
            icon={<Unlock className="size-4" />}
          >
            Déverrouiller le compte
          </GatedButton>
          <GatedButton
            readOnly={readOnly}
            disabled={emailVerified || pending !== null}
            loading={pending === "verify-email"}
            onClick={() => runAction("verify-email", "verify-email")}
            icon={<CheckCircle2 className="size-4" />}
          >
            Marquer l'email vérifié
          </GatedButton>
        </div>
      </section>

      {/* Sessions actives */}
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Monitor className="size-4" />
            Sessions actives ({security.activeSessions.length})
            {security.expiredSessionsCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                · {security.expiredSessionsCount} expirée(s)
              </span>
            )}
          </h2>
          {security.activeSessions.length > 0 && (
            <GatedButton
              readOnly={readOnly}
              variant="outline"
              size="sm"
              disabled={pending !== null}
              loading={pending === "revoke-all"}
              onClick={() => revoke(null, "revoke-all")}
            >
              Révoquer toutes
            </GatedButton>
          )}
        </div>
        {security.activeSessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune session active.
          </p>
        ) : (
          <div className="divide-y">
            {security.activeSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {shortUserAgent(s.userAgent)}
                    {s.impersonatedBy && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-px text-[11px] text-violet-600 dark:text-violet-300">
                        <Eye className="size-3" />
                        Impersonation
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ipAddress || "IP inconnue"} · ouverte {formatDateTime(s.createdAt)} ·
                    expire {formatDateTime(s.expiresAt)}
                  </p>
                </div>
                <GatedButton
                  readOnly={readOnly}
                  variant="ghost"
                  size="sm"
                  disabled={pending !== null}
                  loading={pending === `revoke-${s.id}`}
                  onClick={() => revoke(s.id, `revoke-${s.id}`)}
                >
                  Révoquer
                </GatedButton>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historique d'impersonation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ImpersonationList
          title="Vu « en tant que » (subies)"
          empty="Ce compte n'a jamais été impersonné."
          rows={security.impersonationsReceived}
          counterpartLabel="Par"
        />
        <ImpersonationList
          title="Impersonations menées"
          empty="Ce compte n'a mené aucune impersonation."
          rows={security.impersonationsMade}
          counterpartLabel="Cible"
        />
      </div>

      {/* Bannissement */}
      <section className="overflow-hidden rounded-xl border border-red-300 bg-card dark:border-red-900/50">
        <div className="border-b border-red-200 px-4 py-3 dark:border-red-900/50">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
            <Ban className="size-4" />
            Bannissement
          </h2>
        </div>
        <div className="p-4">
          {banned ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Compte banni
                {user.banReason ? (
                  <>
                    {" "}
                    — <span className="italic">« {user.banReason} »</span>
                  </>
                ) : null}
                {user.banExpires
                  ? ` (jusqu'au ${new Date(user.banExpires).toLocaleDateString("fr-FR")})`
                  : " (permanent)"}
              </p>
              <div>
                <GatedButton
                  readOnly={readOnly}
                  variant="outline"
                  disabled={pending !== null}
                  loading={pending === "unban"}
                  onClick={runUnban}
                  icon={<CheckCircle2 className="size-4" />}
                >
                  Débannir le compte
                </GatedButton>
              </div>
            </div>
          ) : !banOpen ? (
            <GatedButton
              readOnly={readOnly}
              variant="outline"
              disabled={pending !== null}
              onClick={() => setBanOpen(true)}
              icon={<Ban className="size-4" />}
            >
              Bannir le compte
            </GatedButton>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ban-reason">Raison (obligatoire)</Label>
                <Textarea
                  id="ban-reason"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Motif du bannissement (visible dans l'audit)…"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ban-expires">Expiration (optionnel)</Label>
                <Input
                  id="ban-expires"
                  type="datetime-local"
                  value={banExpires}
                  onChange={(e) => setBanExpires(e.target.value)}
                  className="w-fit"
                />
                <p className="text-xs text-muted-foreground">
                  Vide = bannissement permanent. Le ban révoque immédiatement les
                  sessions actives.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBanOpen(false)}
                  disabled={pending !== null}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={runBan}
                  disabled={pending !== null || banReason.trim().length < 3}
                  className="gap-1.5"
                >
                  {pending === "ban" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Ban className="size-4" />
                  )}
                  Confirmer le bannissement
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function SecCell({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "warn"
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-medium",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}

function ImpersonationList({
  title,
  empty,
  rows,
  counterpartLabel,
}: {
  title: string
  empty: string
  rows: UserSecurity["impersonationsReceived"]
  counterpartLabel: string
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4" />
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((l) => (
            <li key={l.id} className="px-4 py-3 text-sm">
              <p className="font-medium">
                <span className="text-muted-foreground">{counterpartLabel} :</span>{" "}
                {l.counterpartName || l.counterpartEmail || "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(l.startedAt)}
                {l.stoppedAt ? ` → ${formatDateTime(l.stoppedAt)}` : " · en cours"}
              </p>
              {l.reason && (
                <p className="mt-0.5 text-xs italic text-muted-foreground">
                  « {l.reason} »
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/// Bouton qui respecte le mode lecture seule (impersonation) : désactivé +
/// tooltip explicatif quand readOnly.
function GatedButton({
  readOnly,
  disabled,
  loading,
  onClick,
  icon,
  children,
  variant = "outline",
  size = "sm",
}: {
  readOnly: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: "outline" | "ghost" | "default"
  size?: "sm" | "default"
}) {
  if (readOnly) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span tabIndex={0}>
                <Button variant={variant} size={size} disabled className="gap-1.5">
                  {icon}
                  {children}
                </Button>
              </span>
            }
          />
          <TooltipContent>{IMPERSONATION_READ_ONLY_REASON}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClick}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </Button>
  )
}
