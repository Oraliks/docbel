import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import {
  buildUsersOrderBy,
  buildUsersWhere,
  normalizeEmail,
  parseUsersQuery,
  resolveUserSegmentFields,
  SAFE_USER_SELECT,
  serializeUser,
  validatePassword,
} from "@/lib/users"
import { NextRequest, NextResponse } from "next/server"
import * as bcrypt from "bcryptjs"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Champs de segment partagés (create + update). Optionnels/nullish côté Zod ;
// la cohérence (TVA employeur, partnerType partenaire) est appliquée par
// resolveUserSegmentFields.
const segmentFields = {
  segment: z.string().nullish(),
  partnerType: z.string().nullish(),
  vatNumber: z.string().nullish(),
  partnerOrganization: z.string().nullish(),
  isOrgManager: z.boolean().optional(),
  canViewRdvHistory: z.boolean().optional(),
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis"),
  email: z.string().trim().min(1, "L'email est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
  role: z
    .enum(["user", "partner", "employer", "moderator", "admin"])
    .default("user"),
  status: z.enum(["active", "pending", "disabled", "locked"]).default("active"),
  ...segmentFields,
})

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
    const parsed = createUserSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400, headers: jsonHeaders },
      )
    }

    const { name, role, status, password } = parsed.data
    const email = normalizeEmail(parsed.data.email)

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers: jsonHeaders })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json(
        { error: passwordError },
        { status: 400, headers: jsonHeaders }
      )
    }

    const segment = resolveUserSegmentFields(parsed.data)
    if (!segment.ok) {
      return NextResponse.json(
        { error: segment.error },
        { status: 400, headers: jsonHeaders },
      )
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 409, headers: jsonHeaders }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: name.trim(),
          email,
          password: hashedPassword,
          role,
          status,
          ...segment.fields,
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
    // Contrainte d'unicité TVA (vatNumber @unique) → 409 lisible.
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
    console.error("Failed to create user:", error)
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500, headers: jsonHeaders }
    )
  }
}
