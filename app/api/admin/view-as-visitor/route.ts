import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAdminAuth } from "@/lib/auth-check"
import { prisma } from "@/lib/prisma"
import {
  readBetterAuthSessionCookie,
  stashAdminSessionAndGoVisitor,
} from "@/lib/admin/stash-cookie"

/// POST /api/admin/view-as-visitor
///
/// Bascule l'admin en mode "visiteur anonyme" :
///   1. Sauvegarde le cookie session Better Auth dans un stash signé HMAC.
///   2. Supprime le cookie session côté navigateur (la session DB reste
///      vivante — restauration possible 1-clic via /api/admin/restore-admin).
///   3. Pose un cookie marqueur lisible client (la bannière le détecte).
///   4. Log AdminImpersonationLog avec targetId = adminId pour audit
///      (convention : targetId == adminId signifie mode visiteur).
///
/// Réservé aux admins (vrais admins, pas en impersonation).
export async function POST(req: NextRequest) {
  const authResult = await requireAdminAuth()
  if (!authResult.isAuthorized) return authResult.error
  const adminUser = authResult.user

  // Raison (optionnelle en dev, obligatoire >=10 chars en prod — meme
  // garde-fou que /api/admin/impersonate pour rester cohérent dans l'audit).
  let reason: string | null = null
  try {
    const body = (await req.json()) as { reason?: unknown }
    if (typeof body.reason === "string") {
      const t = body.reason.trim()
      if (t.length > 0) reason = t
    }
  } catch {
    // pas de body = ok (compat clients qui ne posteraient rien)
  }
  if (process.env.NODE_ENV === "production" && (!reason || reason.length < 10)) {
    return NextResponse.json(
      {
        error: "Raison requise en production (10 caractères minimum)",
        code: "reason_required",
      },
      { status: 400 }
    )
  }

  const sessionCookie = await readBetterAuthSessionCookie()
  if (!sessionCookie) {
    return NextResponse.json(
      { error: "Cookie session Better Auth introuvable" },
      { status: 400 }
    )
  }

  await stashAdminSessionAndGoVisitor({
    cookieName: sessionCookie.name,
    cookieValue: sessionCookie.value,
    adminId: adminUser.id,
  })

  const reqHeaders = await headers()
  await prisma.adminImpersonationLog.create({
    data: {
      adminId: adminUser.id,
      // Convention : targetId == adminId → mode visiteur. Évite d'introduire
      // un champ "mode" dédié et garde la FK valide.
      targetId: adminUser.id,
      ipAddress:
        reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: reqHeaders.get("user-agent"),
      reason,
    },
  })

  return NextResponse.json({ ok: true })
}
