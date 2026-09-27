import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import { apiError, apiOk } from "@/lib/api/response"
import { deleteUserAndPersonalData } from "@/lib/users-delete"
import {
  normalizeEmail,
  resolveUserSegmentFields,
  SAFE_USER_SELECT,
  serializeUser,
  validatePassword,
} from "@/lib/users"
import * as bcrypt from "bcryptjs"

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
      return apiError(404, "User not found")
    }

    return apiOk(serializeUser(user))
  } catch {
    return apiError(500, "Failed to fetch user")
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
      return apiError(400, parsed.error.issues[0]?.message ?? "Données invalides")
    }

    const { name, role, status, password } = parsed.data
    const email = parsed.data.email ? normalizeEmail(parsed.data.email) : undefined

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return apiError(404, "User not found")
    }

    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      return apiError(400, "Email invalide")
    }

    if (email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id },
        },
      })

      if (emailExists) {
        return apiError(409, "Cet email est déjà utilisé")
      }
    }

    const passwordError = password ? validatePassword(password) : null
    if (passwordError) {
      return apiError(400, passwordError)
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
        return apiError(400, segment.error)
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

      // Révoquer aussi les sessions où cet admin impersonait un autre compte.
      // L'écriture et la révocation doivent réussir ou échouer ensemble.
      if (
        newPasswordHash ||
        (role !== undefined && role !== user.role) ||
        (status !== undefined && status !== "active")
      ) {
        await tx.session.deleteMany({
          where: { OR: [{ userId: id }, { impersonatedBy: id }] },
        })
      }

      return result
    })

    return apiOk(serializeUser(updatedUser))
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target
      const onVat = Array.isArray(target)
        ? target.includes("vatNumber")
        : typeof target === "string" && target.includes("vatNumber")
      return apiError(409, onVat ? "Ce numéro de TVA est déjà utilisé" : "Contrainte d'unicité")
    }
    console.error("Error updating user:", error)
    return apiError(500, "Failed to update user")
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
      return apiError(404, "User not found")
    }

    if (authCheck.user?.id === id) {
      return apiError(400, "You cannot delete your own account")
    }

    await deleteUserAndPersonalData(id)

    return apiOk({ message: "User deleted successfully" })
  } catch (error) {
    console.error("Error deleting user:", error)
    return apiError(500, "Failed to delete user")
  }
}
