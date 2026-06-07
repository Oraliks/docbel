import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserStatus } from "@prisma/client"

/// GET /api/admin/recent-impersonations
///
/// Renvoie les 3 derniers targets impersonifiés par l'admin courant
/// (distinct sur targetId), pour alimenter la section "Récemment vu comme"
/// du ViewAsMenu (#6).
///
/// Exclut le mode visiteur (adminId == targetId) et les sessions où le
/// target n'existe plus ou n'est plus actif.
///
/// Auth : admin direct OU session impersonée dont impersonatedBy est un
/// admin actif (même assouplissement que /api/admin/demo-accounts pour
/// que la bannière puisse aussi montrer un MRU si on étend l'UI plus tard).
export async function GET() {
  const headerList = await headers()
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const impersonatedBy = (session.session as { impersonatedBy?: string | null })
    .impersonatedBy
  const adminUserId = impersonatedBy ?? session.user.id
  const adminUser = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true, status: true },
    })
  ).catch(() => null)
  if (!adminUser || adminUser.role !== "admin" || adminUser.status !== UserStatus.active) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // On limite à 20 lignes côté DB (sur l'index startedAt DESC, c'est rapide)
  // et on dédoublonne côté JS — Prisma 5 n'expose pas DISTINCT ON Postgres.
  // 20 = 3 targets distincts couvre 99% des cas même si l'admin re-switche
  // souvent entre les mêmes.
  const logs = await prisma.adminImpersonationLog.findMany({
    where: {
      adminId: adminUserId,
      // exclu visiteur anonyme (convention adminId == targetId)
      NOT: { targetId: adminUserId },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      target: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          partnerOrganization: true,
          segment: true,
          status: true,
        },
      },
    },
  })

  const seen = new Set<string>()
  const recent: Array<{
    id: string
    email: string
    name: string
    role: string
    partnerOrganization: string | null
    segment: string | null
  }> = []
  for (const log of logs) {
    if (seen.has(log.target.id)) continue
    if (log.target.status !== UserStatus.active) continue
    seen.add(log.target.id)
    recent.push({
      id: log.target.id,
      email: log.target.email,
      name: log.target.name,
      role: log.target.role,
      partnerOrganization: log.target.partnerOrganization,
      segment: log.target.segment,
    })
    if (recent.length === 3) break
  }

  return NextResponse.json({ recent })
}
