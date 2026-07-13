import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard"
import { SAFE_USER_SELECT, serializeUser } from "@/lib/users"
import { UserStatus } from "@prisma/client"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

// Actions admin ponctuelles sur un compte. Toute action inconnue → 400 (schéma).
const actionSchema = z.object({
  action: z.enum(["unlock", "verify-email", "ban", "unban"]),
  /// Obligatoire pour "ban".
  reason: z.string().trim().optional(),
  /// ISO ; null/absent = bannissement permanent.
  expiresAt: z.string().datetime().nullish(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  const writeBlock = await ensureWriteAllowed()
  if (writeBlock) return writeBlock

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Action invalide" },
        { status: 400, headers: jsonHeaders },
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: jsonHeaders },
      )
    }

    const { action, reason, expiresAt } = parsed.data

    if (action === "ban") {
      if (authCheck.user?.id === id) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas bannir votre propre compte." },
          { status: 400, headers: jsonHeaders },
        )
      }
      if (!reason) {
        return NextResponse.json(
          { error: "La raison du bannissement est obligatoire." },
          { status: 400, headers: jsonHeaders },
        )
      }
      // Ban + révocation des sessions dans la même transaction : better-auth
      // lit `banned` au getSession, mais on coupe aussi les sessions existantes
      // pour un effet immédiat garanti.
      const [updated] = await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: {
            banned: true,
            banReason: reason,
            banExpires: expiresAt ? new Date(expiresAt) : null,
          },
          select: SAFE_USER_SELECT,
        }),
        prisma.session.deleteMany({ where: { userId: id } }),
      ])
      return NextResponse.json(serializeUser(updated), { headers: jsonHeaders })
    }

    if (action === "unban") {
      const updated = await prisma.user.update({
        where: { id },
        data: { banned: false, banReason: null, banExpires: null },
        select: SAFE_USER_SELECT,
      })
      return NextResponse.json(serializeUser(updated), { headers: jsonHeaders })
    }

    if (action === "unlock") {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          // Un compte "locked" redevient actif ; les autres statuts sont
          // laissés tels quels (pending/disabled ne sont pas des verrous).
          status:
            user.status === UserStatus.locked
              ? UserStatus.active
              : user.status,
        },
        select: SAFE_USER_SELECT,
      })
      return NextResponse.json(serializeUser(updated), { headers: jsonHeaders })
    }

    // action === "verify-email"
    const updated = await prisma.user.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      select: SAFE_USER_SELECT,
    })
    return NextResponse.json(serializeUser(updated), { headers: jsonHeaders })
  } catch (error) {
    console.error("Failed to run user action:", error)
    return NextResponse.json(
      { error: "Échec de l'action" },
      { status: 500, headers: jsonHeaders },
    )
  }
}
