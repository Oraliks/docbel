import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserStatus } from "@prisma/client"

/// GET /api/admin/demo-accounts — liste les comptes "demo+*@docbel.local"
/// utilisée par :
///   - le dropdown ViewAsMenu (admin pas encore impersonifié)
///   - le switcher dans ImpersonationBanner (admin déjà impersonifié)
///
/// Accepte 2 contextes d'auth :
///   1. session normale admin (role=admin, active)
///   2. session impersonée dont impersonatedBy pointe sur un admin actif
///      (sinon switcher dans la bannière impossible — la session courante
///      n'est plus admin, c'est attendu).
export async function GET() {
  const headerList = await headers()
  const session = await withDbRetry(() =>
    auth.api.getSession({ headers: headerList })
  ).catch(() => null)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Cas 1 : admin direct. Cas 2 : session impersonée → check l'admin source.
  const impersonatedBy = (session.session as { impersonatedBy?: string | null }).impersonatedBy
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

  const accounts = await prisma.user.findMany({
    where: { email: { startsWith: "demo+", endsWith: "@docbel.local" } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      partnerOrganization: true,
      segment: true,
    },
    orderBy: { role: "asc" },
  })

  return NextResponse.json({ accounts })
}
