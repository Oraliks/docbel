import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserRole, UserStatus } from "@prisma/client"

const PAGE_SIZE = 20

type SearchParams = Promise<{ page?: string }>

/// Page admin /admin/impersonation — audit des sessions d'impersonation
/// (table AdminImpersonationLog). Affiche qui a impersonifie qui, quand,
/// combien de temps, et pourquoi.
///
/// Sert aussi de visibilité sur le mode "visiteur anonyme" (convention :
/// adminId == targetId).
///
/// Auth : seulement admin actif. Pas accessible sous impersonation.
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

  const [logs, total] = await Promise.all([
    prisma.adminImpersonationLog.findMany({
      orderBy: { startedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        admin: { select: { email: true, name: true } },
        target: { select: { email: true, name: true, role: true } },
      },
    }),
    prisma.adminImpersonationLog.count(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Audit impersonations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique des sessions « Voir en tant que » et « Visiteur anonyme ».
          Chaque ligne est créée par /api/admin/impersonate ou
          /api/admin/view-as-visitor, et fermée par /api/admin/stop-impersonate
          ou /api/admin/restore-admin. {total} entrée{total > 1 ? "s" : ""}.
        </p>
      </header>

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
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Aucune impersonation enregistrée.
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
                    <div className="font-medium">{log.admin.name || log.admin.email}</div>
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
            href={`?page=${page - 1}`}
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
            href={`?page=${page + 1}`}
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
