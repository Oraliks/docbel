"use client"

import { type ReactNode, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  BadgeCheck,
  Ban,
  Building2,
  CalendarClock,
  Eye,
  FileText,
  FolderOpen,
  KeyRound,
  Loader2,
  LockKeyhole,
  MailWarning,
  PencilLine,
  ShieldAlert,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  isBanActive,
  isLockActive,
  type User360,
} from "@/lib/admin/user-360"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ImpersonationReasonDialog,
  type ImpersonationTarget,
} from "@/components/admin/impersonation-reason-dialog"

const ROLE_LABELS: Record<string, string> = {
  user: "Citoyen",
  partner: "Partenaire",
  employer: "Employeur",
  moderator: "Modérateur",
  admin: "Administrateur",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Actif",
  pending: "En attente",
  locked: "Verrouillé",
  disabled: "Désactivé",
}

const SEGMENT_LABELS: Record<string, string> = {
  partenaire: "Partenaire",
  employeur: "Employeur",
}

export const USER_TABS = [
  "apercu",
  "securite",
  "profil",
  "activite",
  "edition",
] as const
export type UserTab = (typeof USER_TABS)[number]

function isUserTab(v: string): v is UserTab {
  return (USER_TABS as readonly string[]).includes(v)
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "admin":
      return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300"
    case "moderator":
      return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
    case "partner":
      return "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
    case "employer":
      return "bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300"
    default:
      return "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
  }
}

function statusDotClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500"
    case "pending":
      return "bg-amber-500"
    case "locked":
      return "bg-orange-500"
    default:
      return "bg-muted-foreground/60"
  }
}

function initials(name: string, email: string): string {
  const source = name?.trim() || email
  return (
    source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface UserDetailShellProps {
  data: User360
  initialTab: UserTab
  /// Panneaux fournis par les lots suivants (Sécurité, Profil, Activité,
  /// Édition). Non fournis → placeholder "bientôt".
  securitySlot?: ReactNode
  profileSlot?: ReactNode
  activitySlot?: ReactNode
  editionSlot?: ReactNode
}

export function UserDetailShell({
  data,
  initialTab,
  securitySlot,
  profileSlot,
  activitySlot,
  editionSlot,
}: UserDetailShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [tab, setTab] = useState<UserTab>(initialTab)

  const { user } = data
  const banActive = isBanActive(user.banned, user.banExpires)
  const lockActive = isLockActive(user.lockedUntil)
  const emailUnverified = !user.emailVerified && !user.emailVerifiedAt

  function changeTab(next: string) {
    if (!isUserTab(next)) return
    setTab(next)
    const params = new URLSearchParams()
    if (next !== "apercu") params.set("tab", next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const orgHref =
    user.segment === "employeur"
      ? "/admin/employeurs"
      : user.segment === "partenaire"
        ? "/admin/partenaires"
        : null

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <Button
          render={<Link href="/admin/users" />}
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 gap-2"
        >
          <ArrowLeftIcon className="size-4" />
          Retour aux utilisateurs
        </Button>

        <div className="flex flex-wrap items-start gap-4">
          <div
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold",
              "bg-violet-500/15 text-violet-600 dark:text-violet-300",
            )}
            aria-hidden
          >
            {initials(user.name, user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {user.name?.trim() || "(Sans nom)"}
            </h1>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              {user.email}
              {user.emailVerifiedAt ? (
                <BadgeCheck className="size-4 text-emerald-500" aria-label="Email vérifié" />
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
                  roleBadgeClass(user.role),
                )}
              >
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {user.segment && (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 text-xs font-medium">
                  <Building2 className="size-3" />
                  {SEGMENT_LABELS[user.segment] ?? user.segment}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className={cn("size-1.5 rounded-full", statusDotClass(user.status))} />
                {STATUS_LABELS[user.status] ?? user.status}
              </span>
              {user.partnerOrganization &&
                (orgHref ? (
                  <Link
                    href={orgHref}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {user.partnerOrganization}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {user.partnerOrganization}
                  </span>
                ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.role !== "admin" && (
              <ImpersonateButton
                target={{
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                  partnerOrganization: user.partnerOrganization,
                }}
              />
            )}
            <Button size="sm" className="gap-1.5" onClick={() => changeTab("edition")}>
              <PencilLine className="size-4" />
              Modifier
            </Button>
          </div>
        </div>

        {(banActive || lockActive || emailUnverified) && (
          <div className="mt-4 flex flex-col gap-2">
            {banActive && (
              <Alert
                icon={<Ban className="size-4" />}
                tone="danger"
                title="Compte banni"
                detail={
                  user.banReason
                    ? `${user.banReason}${
                        user.banExpires
                          ? ` — jusqu'au ${formatDateTime(user.banExpires)}`
                          : " — permanent"
                      }`
                    : user.banExpires
                      ? `Jusqu'au ${formatDateTime(user.banExpires)}`
                      : "Bannissement permanent"
                }
              />
            )}
            {lockActive && (
              <Alert
                icon={<LockKeyhole className="size-4" />}
                tone="warning"
                title="Compte verrouillé (anti-bruteforce)"
                detail={`${user.failedLoginAttempts} tentative(s) échouée(s) — déverrouillage automatique le ${formatDateTime(user.lockedUntil)}`}
              />
            )}
            {emailUnverified && (
              <Alert
                icon={<MailWarning className="size-4" />}
                tone="warning"
                title="Email non vérifié"
                detail="L'adresse n'a jamais été confirmée."
              />
            )}
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList variant="line" className="h-9 w-full justify-start gap-1 border-b">
          <TabsTrigger value="apercu">Aperçu</TabsTrigger>
          <TabsTrigger value="securite">Sécurité</TabsTrigger>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="edition">Édition</TabsTrigger>
        </TabsList>

        <TabsContent value="apercu" className="pt-4">
          <OverviewPanel data={data} />
        </TabsContent>
        <TabsContent value="securite" className="pt-4">
          {securitySlot ?? <ComingSoon label="Sécurité" />}
        </TabsContent>
        <TabsContent value="profil" className="pt-4">
          {profileSlot ?? <ComingSoon label="Profil" />}
        </TabsContent>
        <TabsContent value="activite" className="pt-4">
          {activitySlot ?? <ComingSoon label="Activité" />}
        </TabsContent>
        <TabsContent value="edition" className="pt-4">
          {editionSlot ?? <ComingSoon label="Édition" />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Alert({
  icon,
  tone,
  title,
  detail,
}: {
  icon: ReactNode
  tone: "danger" | "warning"
  title: string
  detail: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "danger"
          ? "border-red-300 bg-red-50/60 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          : "border-amber-300 bg-amber-50/60 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground"> — {detail}</span>
      </span>
    </div>
  )
}

function OverviewPanel({ data }: { data: User360 }) {
  const { user, counts } = data
  const cells: Array<{
    label: string
    value: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { label: "Dernier login", value: formatDateTime(user.lastLoginAt), icon: KeyRound },
    { label: "Sessions actives", value: String(counts.activeSessions), icon: ShieldAlert },
    { label: "Compte créé le", value: formatDateTime(user.createdAt), icon: CalendarClock },
    { label: "Mot de passe changé le", value: formatDateTime(user.passwordChangedAt), icon: KeyRound },
    { label: "Dossiers", value: String(counts.dossiers), icon: FolderOpen },
    { label: "Brouillons PDF", value: String(counts.drafts), icon: FileText },
    { label: "Rendez-vous", value: String(counts.bookings), icon: CalendarClock },
    { label: "Impersonations subies", value: String(counts.impersonationsAsTarget), icon: Eye },
  ]

  return (
    <div className="flex flex-col gap-4">
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-3 lg:grid-cols-4">
          {cells.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="bg-card px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3.5" />
                  {c.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium tabular-nums" title={c.value}>
                  {c.value}
                </p>
              </div>
            )
          })}
        </div>
        {(user.segment === "employeur" ||
          counts.costSimulations > 0 ||
          counts.documentDrafts > 0 ||
          counts.impersonationsAsAdmin > 0) && (
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
            <MiniCell label="Simulations de coût" value={counts.costSimulations} icon={UserCog} />
            <MiniCell label="Documents (brouillons)" value={counts.documentDrafts} icon={FileText} />
            <MiniCell
              label="Impersonations menées"
              value={counts.impersonationsAsAdmin}
              icon={Eye}
            />
          </div>
        )}
      </section>
    </div>
  )
}

function MiniCell({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
      {label} — bientôt disponible
    </div>
  )
}

/// Bouton "Voir en tant que" de la fiche : impersonation directe de CE compte.
/// En dev : bascule immédiate. En prod : passe par la modal de raison (comme
/// ViewAsMenu), qui alimente AdminImpersonationLog.reason.
function ImpersonateButton({ target }: { target: ImpersonationTarget }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)

  async function run(reason: string | null) {
    setPending(true)
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id, reason }),
      })
      if (!res.ok) {
        const error = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error.error || "Impersonation impossible")
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={pending}
        onClick={() => {
          if (process.env.NODE_ENV === "production") setReasonOpen(true)
          else void run(null)
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
        Voir en tant que
      </Button>
      <ImpersonationReasonDialog
        target={reasonOpen ? target : null}
        onOpenChange={(open) => {
          if (!open) setReasonOpen(false)
        }}
        onConfirm={async (reason) => {
          await run(reason)
          setReasonOpen(false)
        }}
      />
    </>
  )
}
