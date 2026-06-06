import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { readAdminStash, restoreAdminSession } from "@/lib/admin/stash-cookie"

/// POST /api/admin/restore-admin
///
/// Termine le mode visiteur anonyme et restaure la session admin :
///   1. Lit le stash signé HMAC.
///   2. Vérifie que la session DB associée existe encore et n'a pas expiré.
///   3. Repose le cookie session Better Auth tel quel.
///   4. Ferme la ligne d'audit ouverte (adminId == targetId, stoppedAt null).
///
/// Sans guard d'auth (la session admin n'est plus posée pendant le mode
/// visiteur) — la sécurité est portée par la signature HMAC du stash.
export async function POST() {
  const payload = await readAdminStash()
  if (!payload) {
    return NextResponse.json(
      { error: "Aucune session admin à restaurer" },
      { status: 400 }
    )
  }

  // Vérification : la session DB doit toujours être valide. Sinon, le stash
  // pointe vers une session expirée → on refuse plutôt que de reposer un
  // cookie mort.
  const sessions = await prisma.session.findMany({
    where: {
      userId: payload.adminId,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
    take: 1,
  })
  if (sessions.length === 0) {
    return NextResponse.json(
      { error: "Session admin expirée — reconnecte-toi" },
      { status: 410 }
    )
  }

  await restoreAdminSession(payload)

  // Ferme la ligne d'audit visiteur la plus récente encore ouverte.
  await prisma.adminImpersonationLog.updateMany({
    where: {
      adminId: payload.adminId,
      targetId: payload.adminId,
      stoppedAt: null,
    },
    data: { stoppedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
