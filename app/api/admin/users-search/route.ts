import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserStatus } from "@prisma/client"

/// GET /api/admin/users-search?q=...
///
/// Recherche un user impersonifiable par email / nom / partnerOrganization.
/// Utilise par le bloc "Rechercher un vrai user" dans ViewAsMenu (Phase D #7).
///
/// Auth : admin direct OU session impersonee dont impersonatedBy est un
/// admin actif (meme assouplissement que /api/admin/demo-accounts pour que
/// le switcher de la banniere puisse aussi proposer la recherche).
///
/// Exclut : role=admin, status != active. Resultats limites a 10.
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { status: UserStatus.active },
        { NOT: { role: "admin" } },
        {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { partnerOrganization: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      partnerOrganization: true,
      segment: true,
    },
    take: 10,
    orderBy: [{ role: "asc" }, { email: "asc" }],
  })

  return NextResponse.json({ users })
}
