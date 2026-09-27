import { NextRequest } from "next/server"
import { headers, cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdminAuth } from "@/lib/auth-check"
import { prisma } from "@/lib/prisma"
import { isDemoEmail } from "@/lib/admin/demo-users"
import { READONLY_COOKIE } from "@/lib/admin/readonly-guard"
import { apiError, apiOk } from "@/lib/api/response"

/// POST /api/admin/impersonate
/// Body : { userId: string }
///
/// Démarre une session d'impersonation sur le user cible. Garde-fous :
///   - réservé à role=admin (via requireAdminAuth)
///   - refuse si target.role=admin (un admin ne peut pas impersonifier un autre admin)
///   - refuse si target.status != active
///
/// Posté par ViewAsMenu (shell admin). La session admin est sauvegardée par le
/// plugin admin Better Auth dans le cookie "admin_session" et restaurée par
/// /api/admin/stop-impersonate.
///
/// Un AdminImpersonationLog est créé pour audit (stoppedAt rempli quand on stop).
export async function POST(req: NextRequest) {
  const authResult = await requireAdminAuth()
  if (!authResult.isAuthorized) return authResult.error
  const adminUser = authResult.user

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError(400, "Invalid JSON")
  }

  const userId =
    typeof body === "object" && body && "userId" in body && typeof body.userId === "string"
      ? body.userId
      : null
  if (!userId) {
    return apiError(400, "userId requis")
  }

  // Raison (Phase C #11) : obligatoire en prod, optionnelle ailleurs.
  const rawReason =
    typeof body === "object" && body && "reason" in body && typeof body.reason === "string"
      ? body.reason.trim()
      : ""
  const reason = rawReason.length > 0 ? rawReason : null
  if (process.env.NODE_ENV === "production" && (!reason || reason.length < 10)) {
    return apiError(400, "Raison requise en production (10 caractères minimum)", {
      code: "reason_required",
    })
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, email: true },
  })
  if (!target) {
    return apiError(404, "Compte introuvable")
  }
  if (target.role === "admin") {
    return apiError(403, "Impossible d'impersonifier un autre admin")
  }
  if (target.status !== "active") {
    return apiError(400, "Le compte cible n'est pas actif")
  }

  const reqHeaders = await headers()

  // Écrire le journal AVANT de créer la session : si l'audit échoue, aucun
  // cookie d'impersonation ne doit être posé par le plugin nextCookies().
  const auditLog = await prisma.adminImpersonationLog.create({
    data: {
      adminId: adminUser.id,
      targetId: target.id,
      ipAddress: reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: reqHeaders.get("user-agent"),
      reason,
    },
  })

  try {
    // nextCookies() propage les Set-Cookie à la réponse Next.js.
    await auth.api.impersonateUser({
      body: { userId: target.id },
      headers: reqHeaders,
    })
  } catch (error) {
    // Conserver la tentative auditée, sans la laisser apparaître en cours.
    await prisma.adminImpersonationLog.updateMany({
      where: { id: auditLog.id, stoppedAt: null },
      data: { stoppedAt: new Date() },
    }).catch((auditError) => {
      console.error("Failed to close unsuccessful impersonation audit:", auditError)
    })
    throw error
  }

  // Phase D #7 garde-fou : si on impersonifie un VRAI user (pas un compte
  // demo), on force le mode lecture seule a ON par defaut, peu importe l'env.
  // L'admin peut le desactiver via le cadenas de la banniere s'il a vraiment
  // besoin d'ecrire (rare, et c'est trace dans le toggle).
  if (!isDemoEmail(target.email)) {
    const c = await cookies()
    c.set(READONLY_COOKIE, "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  }

  return apiOk({ ok: true, targetEmail: target.email })
}
