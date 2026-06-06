import { NextRequest, NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import { auth } from "@/lib/auth"
import { READONLY_COOKIE } from "@/lib/admin/readonly-guard"

/// POST /api/admin/impersonation-readonly
/// Body : { enabled: boolean }
///
/// Bascule le cookie de mode lecture seule pour les sessions d'impersonation.
/// Pas de guard admin classique : pendant l'impersonation, la session active
/// est celle du target. On accepte uniquement si :
///   - la session est impersonée (impersonatedBy non null)
/// Le cookie est posé pour la durée de la session BA (30j max).
export async function POST(req: NextRequest) {
  const headerList = await headers()
  const session = await auth.api
    .getSession({ headers: headerList })
    .catch(() => null)
  const impersonatedBy = (
    session?.session as { impersonatedBy?: string | null } | undefined
  )?.impersonatedBy
  if (!impersonatedBy) {
    return NextResponse.json(
      { error: "Aucune impersonation en cours" },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const enabled =
    typeof body === "object" && body && "enabled" in body
      ? Boolean((body as { enabled: unknown }).enabled)
      : null
  if (enabled === null) {
    return NextResponse.json({ error: "enabled requis" }, { status: 400 })
  }

  const c = await cookies()
  c.set(READONLY_COOKIE, enabled ? "1" : "0", {
    httpOnly: false, // bannière le lit côté client pour son état initial
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })

  return NextResponse.json({ ok: true, enabled })
}
