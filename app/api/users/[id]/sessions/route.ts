import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { requireAdminAuth } from "@/lib/auth-check"
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

/// Révoque des sessions d'un utilisateur.
///   DELETE /api/users/[id]/sessions            → toutes les sessions
///   DELETE /api/users/[id]/sessions?sessionId= → une seule session
/// Garde-fou : un admin qui agit sur SON PROPRE compte ne peut pas révoquer la
/// session courante (il se déconnecterait lui-même en plein milieu).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  const writeBlock = await ensureWriteAllowed()
  if (writeBlock) return writeBlock

  try {
    const { id } = await params
    const sessionId = request.nextUrl.searchParams.get("sessionId")

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!target) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: jsonHeaders },
      )
    }

    // Session courante de l'admin (pour ne jamais la couper si l'admin agit sur
    // lui-même).
    const current = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)
    const currentSessionId =
      (current?.session as { id?: string } | undefined)?.id ?? null
    const protectSelf = authCheck.user?.id === id

    const where: {
      userId: string
      id?: string | { not: string }
    } = { userId: id }

    if (sessionId) {
      if (protectSelf && currentSessionId && sessionId === currentSessionId) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas révoquer votre session courante." },
          { status: 400, headers: jsonHeaders },
        )
      }
      where.id = sessionId
    } else if (protectSelf && currentSessionId) {
      where.id = { not: currentSessionId }
    }

    const { count } = await prisma.session.deleteMany({ where })

    return NextResponse.json({ revoked: count }, { headers: jsonHeaders })
  } catch (error) {
    console.error("Failed to revoke sessions:", error)
    return NextResponse.json(
      { error: "Failed to revoke sessions" },
      { status: 500, headers: jsonHeaders },
    )
  }
}
