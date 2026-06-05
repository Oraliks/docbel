import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/// POST /api/admin/stop-impersonate
///
/// Termine la session d'impersonation en cours et restaure la session admin.
/// N'est PAS gardé par requireAdminAuth() : pendant l'impersonation, la
/// session active est celle du target (role != admin), donc requireAdminAuth
/// renverrait 403. On vérifie à la place que session.impersonatedBy est set
/// et on log la fin sur la ligne d'audit ouverte la plus récente.
export async function POST() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })

  const impersonatedBy = (session?.session as { impersonatedBy?: string | null } | undefined)
    ?.impersonatedBy
  if (!session || !impersonatedBy) {
    return NextResponse.json(
      { error: "Pas de session d'impersonation en cours" },
      { status: 400 }
    )
  }

  await auth.api.stopImpersonating({ headers: reqHeaders })

  // Ferme la ligne d'audit la plus récente encore ouverte pour ce couple
  // admin/target. updateMany pour éviter une 404 si l'audit n'a pas été créé
  // (ex: impersonation lancée par un autre canal).
  await prisma.adminImpersonationLog.updateMany({
    where: {
      adminId: impersonatedBy,
      targetId: session.user.id,
      stoppedAt: null,
    },
    data: { stoppedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
