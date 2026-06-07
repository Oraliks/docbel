import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAdminAuth } from "@/lib/auth-check"
import { prisma } from "@/lib/prisma"

/// POST /api/admin/impersonation/force-stop
/// Body : { logId: string }
///
/// Termine de force une session d'impersonation orpheline (stoppedAt=null
/// + cible que l'admin n'a pas explicitement stoppée, ex: navigateur fermé).
///
/// Effet : delete la Session DB de la cible où impersonatedBy = log.adminId
/// (Better Auth admin plugin pose cette FK lors de impersonateUser), et
/// marque le log comme stoppé.
///
/// Réservé aux admins (pas de force-stop sous impersonation).
export async function POST(req: NextRequest) {
  const authResult = await requireAdminAuth()
  if (!authResult.isAuthorized) return authResult.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const logId =
    typeof body === "object" && body && "logId" in body && typeof body.logId === "string"
      ? body.logId
      : null
  if (!logId) {
    return NextResponse.json({ error: "logId requis" }, { status: 400 })
  }

  const log = await prisma.adminImpersonationLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      adminId: true,
      targetId: true,
      stoppedAt: true,
    },
  })
  if (!log) {
    return NextResponse.json({ error: "Log introuvable" }, { status: 404 })
  }
  if (log.stoppedAt) {
    return NextResponse.json({ ok: true, alreadyStopped: true })
  }

  // Cas spécial : mode visiteur anonyme (adminId == targetId). Pas de session
  // DB à supprimer (le cookie stash est côté navigateur). On ferme juste le log.
  if (log.adminId !== log.targetId) {
    // Delete les sessions impersonées encore actives pour ce couple.
    await prisma.session.deleteMany({
      where: {
        userId: log.targetId,
        impersonatedBy: log.adminId,
        expiresAt: { gt: new Date() },
      },
    })
  }

  await prisma.adminImpersonationLog.update({
    where: { id: logId },
    data: { stoppedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
