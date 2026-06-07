import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserRole, UserStatus, Prisma } from "@prisma/client"
import { ForceStopButton } from "@/components/admin/force-stop-button"

const PAGE_SIZE = 20

type SearchParams = Promise<{
  page?: string
  adminId?: string
  targetEmail?: string
  dateFrom?: string
  dateTo?: string
}>

/// Page admin /admin/impersonation — audit des sessions d'impersonation.
///
/// Affiche :
///   - stats header sur les 7 derniers jours (#13)
///   - filtres URL (admin / cible email / dates) (#8)
///   - table paginée (#7 V1)
///   - bouton "Forcer arrêt" pour les lignes en cours (#9)
///   - sert aussi de visibilité sur le mode visiteur anonyme (adminId == targetId)
///
/// Auth : admin actif uniquement (pas accessible sous impersonation).
export default async function ImpersonationAuditPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const headerList = await headers()
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null)
  if (!session?.user?.id) notFound()

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, status: true },
    })
  ).catch(() => null)
  if (
    !user ||
    user.role !== UserRole.admin ||
    user.status !== UserStatus.active
  ) {
    notFound()
  }

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1)
  const skip = (page - 1) * PAGE_SIZE

  // Filtres URL (#8). Tous optionnels et ANDés. dateTo inclusif (fin de jour).
  const where: Prisma.AdminImpersonationLogWhereInput = {}
  if (params.adminId) where.adminId = params.adminId
  if (params.targetEmail) {
    where.target = {
      email: { contains: params.targetEmail, mode: "insensitive" },
    }
  }
  if (params.dateFrom || params.dateTo) {
    where.startedAt = {}
    if (params.dateFrom) {
      const from = new Date(params.dateFrom)
      if (!Number.isNaN(from.getTime())) where.startedAt.gte = from
    }
    if (params.dateTo) {
      const to = new Date(params.dateTo)
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999)
        where.startedAt.lte = to
      }
    }
  }

  // Stats sur les 7 derniers jours (indépendant des filtres pour ne pas
  // troubler la lecture : ce sont des stats "santé globale").
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const [logs, total, weekCount, weekClosed, weekTopAdmins] = await Promise.all([
    prisma.adminImpersonationLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        admin: { select: { email: true, name: true } },
        target: { select: { email: true, name: true, role: true } },
      },
    }),
    prisma.adminImpersonationLog.count({ where }),
    prisma.adminImpersonationLog.count({
      where: { startedAt: { gte: sevenDaysAgo } },
    }),
    prisma.adminImpersonationLog.findMany({
      where: {
        startedAt: { gte: sevenDaysAgo },
        stoppedAt: { not: null },
      },
      select: { startedAt: true, stoppedAt: true },
    }),
    prisma.adminImpersonationLog.groupBy({
      by: ["adminId"],
      where: { startedAt: { gte: sevenDaysAgo } },
      _count: { adminId: true },
      orderBy: { _count: { adminId: "desc" } },
      take: 1,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const avgDurationMs =
    weekClosed.length > 0
      ? weekClosed.reduce(
          (acc, l) => acc + (l.stoppedAt!.getTime() - l.startedAt.getTime()),
          0
        ) / weekClosed.length
      : null

  let topAdminLabel: string | null = null
  if (weekTopAdmins[0]) {
    const topAdmin = await prisma.user.findUnique({
      where: { id: weekTopAdmins[0].adminId },
      select: { email: true, name: true },
    })
    topAdminLabel = topAdmin
      ? `${topAdmin.name || topAdmin.email} (${weekTopAdmins[0]._count.adminId})`
      : null
  }

  // Pour le select "admin" du filtre : liste des admins (max 50, suffisant
  // dans la pratique pour une équipe Beldoc).
  const adminOptions = await prisma.user.findMany({
    where: { role: UserRole.admin, status: UserStatus.active },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
    take: 50,
  })

  const buildPageHref = (nextPage: number) => {
    const sp = new URLSearchParams()
    if (params.adminId) sp.set("adminId", params.adminId)
    if (params.targetEmail) sp.set("targetEmail", params.targetEmail)
    if (params.dateFrom) sp.set("dateFrom", params.dateFrom)
    if (params.dateTo) sp.set("dateTo", params.dateTo)
    sp.set("page", String(nextPage))
    return `?${sp.toString()}`
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit impersonations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique des sessions « Voir en tant que » et « Visiteur anonyme ».
          {total} entrée{total > 1 ? "s" : ""} (sur les filtres actifs).
        </p>
      </header>

      {/* Stats 7j (#13) */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            7 derniers jours
          </div>
          <div className="mt-1 text-2xl font-semibold">{weekCount}</div>
          <div className="text-xs text-muted-foreground">
            session{weekCount > 1 ? "s" : ""} démarrée{weekCount > 1 ? "s" : ""}
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Durée moyenne (closes)
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {avgDurationMs === null ? "—" : formatDuration(avgDurationMs)}
          </div>
          <div className="text-xs text-muted-foreground">
            sur {weekClosed.length} session{weekClosed.length > 1 ? "s" : ""} fermée{weekClosed.length > 1 ? "s" : ""}
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Top admin (7j)
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {topAdminLabel || "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            par nombre d&apos;impersonations
          </div>
        </div>
      </section>

      {/* Filtres (#8) */}
      <form className="mb-4 grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Admin
          </label>
          <select
            name="adminId"
            defaultValue={params.adminId || ""}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Tous les admins</option>
            {adminOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email cible (contient)
          </label>
          <input
            name="targetEmail"
            type="text"
            defaultValue={params.targetEmail || ""}
            placeholder="ex: demo+"
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Depuis
          </label>
          <input
            name="dateFrom"
            type="date"
            defaultValue={params.dateFrom || ""}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Jusqu&apos;au
          </label>
          <input
            name="dateTo"
            type="date"
            defaultValue={params.dateTo || ""}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-5">
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filtrer
          </button>
          <a
            href="?"
            className="h-9 rounded-md border px-4 py-1.5 text-sm hover:bg-muted"
          >
            Réinitialiser
          </a>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Cible</th>
              <th className="px-3 py-2 font-medium">Mode</th>
              <th className="px-3 py-2 font-medium">Démarrée</th>
              <th className="px-3 py-2 font-medium">Durée</th>
              <th className="px-3 py-2 font-medium">Raison</th>
              <th className="px-3 py-2 font-medium">IP</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Aucune impersonation pour ces filtres.
                </td>
              </tr>
            )}
            {logs.map((log) => {
              const isVisitor = log.adminId === log.targetId
              const durationMs = log.stoppedAt
                ? log.stoppedAt.getTime() - log.startedAt.getTime()
                : null
              return (
                <tr key={log.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {log.admin.name || log.admin.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.admin.email}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isVisitor ? (
                      <span className="italic text-muted-foreground">
                        (visiteur anonyme)
                      </span>
                    ) : (
                      <>
                        <div className="font-medium">
                          {log.target.name || log.target.email}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.target.email} · {log.target.role}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isVisitor ? "visiteur" : "impersonation"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {log.startedAt.toLocaleString("fr-BE")}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {durationMs === null ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        en cours
                      </span>
                    ) : (
                      formatDuration(durationMs)
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {log.reason || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {log.ipAddress || "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {log.stoppedAt === null && (
                      <ForceStopButton logId={log.id} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <a
            className={
              page > 1
                ? "text-primary hover:underline"
                : "pointer-events-none text-muted-foreground"
            }
            href={buildPageHref(page - 1)}
          >
            ← Précédent
          </a>
          <span className="text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <a
            className={
              page < totalPages
                ? "text-primary hover:underline"
                : "pointer-events-none text-muted-foreground"
            }
            href={buildPageHref(page + 1)}
          >
            Suivant →
          </a>
        </nav>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem.toString().padStart(2, "0")}` : `${hours}h`
}
