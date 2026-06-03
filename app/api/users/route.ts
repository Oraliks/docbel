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
import { NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    // take borné (convention AGENTS : findMany toujours borné). 1000 = marge
    // large vs le nombre réel de comptes, sans tronquer l'affichage admin.
    const users = await prisma.user.findMany({
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: "desc" },
      take: 1000,
    })

    return NextResponse.json(users.map(serializeUser), { headers: jsonHeaders })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500, headers: jsonHeaders }
    )
  }
}

export async function POST(request: Request) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""
    const password = typeof body.password === "string" ? body.password : ""
    const role = typeof body.role === "string" ? body.role : "user"
    const status = typeof body.status === "string" ? body.status : "active"

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: jsonHeaders })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400, headers: jsonHeaders }
      )
    }

    if (!isUserRole(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400, headers: jsonHeaders })
    }

    if (!isUserStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400, headers: jsonHeaders })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already taken" },
        { status: 409, headers: jsonHeaders }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          status,
        },
        select: SAFE_USER_SELECT,
      })

      await tx.account.create({
        data: {
          id: `acc_${created.id}_credential`,
          accountId: created.id,
          providerId: "credential",
          userId: created.id,
          password: hashedPassword,
        },
      })

      return created
    })

    return NextResponse.json(serializeUser(user), {
      status: 201,
      headers: jsonHeaders,
    })
  } catch (error) {
    console.error("Failed to create user:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500, headers: jsonHeaders }
    )
  }
}
