import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/// POST /api/admin/extend-impersonation
/// Body : { minutes?: number }   // défaut 30, min 5, max 60
///
/// Étend la session d'impersonation en cours de `minutes` minutes
/// supplémentaires (mise à jour de Session.expiresAt côté DB). Évite à
/// l'admin de devoir stop+re-impersonate si son debug prend plus long que
/// l'1h initiale.
///
/// Pas guardé par requireAdminAuth (la session active est celle du target,
/// role != admin) — sécurité portée par le check session.impersonatedBy
/// non-null et le cap dur sur la durée maximale (1h supplémentaire).
const DEFAULT_MINUTES = 30
const MIN_MINUTES = 5
const MAX_MINUTES = 60

export async function POST(req: NextRequest) {
  const reqHeaders = await headers()
  const session = await auth.api
    .getSession({ headers: reqHeaders })
    .catch(() => null)
  const impersonatedBy = (
    session?.session as { impersonatedBy?: string | null } | undefined
  )?.impersonatedBy
  if (!session || !impersonatedBy) {
    return NextResponse.json(
      { error: "Aucune impersonation en cours" },
      { status: 400 }
    )
  }

  let minutes = DEFAULT_MINUTES
  try {
    const body = (await req.json()) as { minutes?: unknown }
    if (typeof body.minutes === "number" && Number.isFinite(body.minutes)) {
      minutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.floor(body.minutes)))
    }
  } catch {
    // pas de body OK, on utilise le défaut
  }

  // On ajoute "minutes" à partir de l'expiration COURANTE (pas du now), ce
  // qui évite qu'un clic au mauvais moment raccourcisse l'allocation : si
  // l'admin clique à 5min restantes, il aura 35min total.
  const sessionRow = await prisma.session.findUnique({
    where: { id: session.session.id },
    select: { expiresAt: true },
  })
  if (!sessionRow) {
    return NextResponse.json(
      { error: "Session DB introuvable" },
      { status: 404 }
    )
  }
  const newExpiresAt = new Date(
    sessionRow.expiresAt.getTime() + minutes * 60 * 1000
  )
  await prisma.session.update({
    where: { id: session.session.id },
    data: { expiresAt: newExpiresAt },
  })

  return NextResponse.json({
    ok: true,
    minutesAdded: minutes,
    newExpiresAt: newExpiresAt.toISOString(),
  })
}
