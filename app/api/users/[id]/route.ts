import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import {
  isUserRole,
  isUserStatus,
  normalizeEmail,
  SAFE_USER_SELECT,
  serializeUser,
  validatePassword,
} from "@/lib/users"
import * as bcrypt from "bcryptjs"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

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
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : undefined
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : undefined
    const password = typeof body.password === "string" ? body.password : undefined
    const role = typeof body.role === "string" ? body.role : undefined
    const status = typeof body.status === "string" ? body.status : undefined

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: jsonHeaders })
    }

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400, headers: jsonHeaders })
    }

    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: jsonHeaders })
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
          { error: "Email is already taken" },
          { status: 409, headers: jsonHeaders }
        )
      }
    }

    if (role && !isUserRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400, headers: jsonHeaders })
    }

    if (status && !isUserStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400, headers: jsonHeaders })
    }

    const passwordError = password ? validatePassword(password) : null
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400, headers: jsonHeaders }
      )
    }

    const updateData: {
      name: string
      email: string
      role: typeof user.role
      status: typeof user.status
      password?: string
      passwordChangedAt?: Date
      failedLoginAttempts?: number
      lockedUntil?: Date | null
    } = {
      name: name || user.name,
      email: email || user.email,
      role: role || user.role,
      status: status || user.status,
    }

    let newPasswordHash: string | undefined
    if (password) {
      newPasswordHash = await bcrypt.hash(password, 10)
      updateData.password = newPasswordHash
      updateData.passwordChangedAt = new Date()
    }

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
