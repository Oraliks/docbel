import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import {
  buildUsersOrderBy,
  buildUsersWhere,
  isUserRole,
  isUserStatus,
  normalizeEmail,
  parseUsersQuery,
  SAFE_USER_SELECT,
  serializeUser,
  validatePassword,
} from "@/lib/users"
import { NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const query = parseUsersQuery(request.nextUrl.searchParams)
    const where = buildUsersWhere(query)

    // Pagination serveur (fin du take: 1000 filtré client). count + page dans
    // une seule transaction pour un total cohérent avec la page renvoyée.
    const [total, rows] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: buildUsersOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    return NextResponse.json(
      {
        users: rows.map(serializeUser),
        total,
        page: query.page,
        pageSize: query.pageSize,
      },
      { headers: jsonHeaders },
    )
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
