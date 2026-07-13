import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import {
  normalizeEmail,
  resolveUserSegmentFields,
  SAFE_USER_SELECT,
  serializeUser,
  validatePassword,
} from "@/lib/users"
import * as bcrypt from "bcryptjs"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().optional(),
  role: z
    .enum(["user", "partner", "employer", "moderator", "admin"])
    .optional(),
  status: z.enum(["active", "pending", "disabled", "locked"]).optional(),
  segment: z.string().nullish(),
  partnerType: z.string().nullish(),
  vatNumber: z.string().nullish(),
  partnerOrganization: z.string().nullish(),
  isOrgManager: z.boolean().optional(),
  canViewRdvHistory: z.boolean().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: jsonHeaders })
    }

    return NextResponse.json(serializeUser(user), { headers: jsonHeaders })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500, headers: jsonHeaders }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const rawBody = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null
    const parsed = updateUserSchema.safeParse(rawBody ?? {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400, headers: jsonHeaders },
      )
    }

    const { name, role, status, password } = parsed.data
    const email = parsed.data.email ? normalizeEmail(parsed.data.email) : undefined

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: jsonHeaders })
    }

    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers: jsonHeaders })
    }

    if (email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      })

      if (emailExists) {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé" },
          { status: 409, headers: jsonHeaders }
        )
      }
    }

    const passwordError = password ? validatePassword(password) : null
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400, headers: jsonHeaders }
      )
    }

    const updateData: Prisma.UserUpdateInput = {
      name: name ?? user.name,
      email: email ?? user.email,
      role: role ?? user.role,
      status: status ?? user.status,
    }

    // Champs de segment : appliqués seulement si le body est "segment-aware"
    // (clé `segment` présente), pour ne pas écraser des comptes édités par un
    // ancien client qui n'envoie pas ces champs.
    if (rawBody && typeof rawBody === "object" && "segment" in rawBody) {
      const segment = resolveUserSegmentFields(parsed.data)
      if (!segment.ok) {
        return NextResponse.json(
          { error: segment.error },
          { status: 400, headers: jsonHeaders },
        )
      }
      Object.assign(updateData, segment.fields)
    }

    let newPasswordHash: string | undefined
    if (password) {
      newPasswordHash = await bcrypt.hash(password, 10)
      updateData.password = newPasswordHash
      updateData.passwordChangedAt = new Date()
    }

    // Réinitialise le compteur anti-bruteforce quand l'admin change le statut
    // vers autre chose que "locked" (déverrouillage explicite).
    if (status && status !== "locked") {
      updateData.failedLoginAttempts = 0
      updateData.lockedUntil = null
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: updateData,
        select: SAFE_USER_SELECT,
      })

      if (newPasswordHash) {
        await tx.account.upsert({
          where: {
            providerId_accountId: { providerId: "credential", accountId: id },
          },
          update: { password: newPasswordHash },
          create: {
            id: `acc_${id}_credential`,
            accountId: id,
            providerId: "credential",
            userId: id,
            password: newPasswordHash,
          },
        })
      }

      return result
    })

    return NextResponse.json(serializeUser(updatedUser), { headers: jsonHeaders })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target
      const onVat = Array.isArray(target)
        ? target.includes("vatNumber")
        : typeof target === "string" && target.includes("vatNumber")
      return NextResponse.json(
        { error: onVat ? "Ce numéro de TVA est déjà utilisé" : "Contrainte d'unicité" },
        { status: 409, headers: jsonHeaders },
      )
    }
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500, headers: jsonHeaders }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: jsonHeaders })
    }

    if (authCheck.user?.id === id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400, headers: jsonHeaders }
      )
    }

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200, headers: jsonHeaders }
    )
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500, headers: jsonHeaders }
    )
  }
}
