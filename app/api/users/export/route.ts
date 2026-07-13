import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"
import {
  buildUsersOrderBy,
  buildUsersWhere,
  parseUsersQuery,
  SAFE_USER_SELECT,
} from "@/lib/users"
import { buildCsv, UTF8_BOM } from "@/lib/baremes/csv"

// Export CSV de la liste users (admin). Respecte les mêmes filtres/tri que la
// liste (via parseUsersQuery) mais IGNORE la pagination : on exporte tout le
// jeu filtré, borné à EXPORT_CAP pour rester sûr. Échappement anti-injection
// formule via buildCsv (partagé avec les exports barèmes).

const EXPORT_CAP = 5000

export async function GET(request: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const query = parseUsersQuery(request.nextUrl.searchParams)
    const where = buildUsersWhere(query)

    const rows = await prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: buildUsersOrderBy(query.sort),
      take: EXPORT_CAP,
    })

    const header = [
      "id",
      "nom",
      "email",
      "email_verifie",
      "role",
      "segment",
      "type_partenaire",
      "organisation",
      "tva",
      "statut",
      "dernier_login",
      "cree_le",
    ]

    const toIso = (d: Date | null | undefined) => (d ? d.toISOString() : "")

    const body = rows.map((u) => [
      u.id,
      u.name,
      u.email,
      u.emailVerifiedAt ? "oui" : "non",
      u.role,
      u.segment ?? "",
      u.partnerType ?? "",
      u.partnerOrganization ?? "",
      u.vatNumber ?? "",
      u.status,
      toIso(u.lastLoginAt),
      toIso(u.createdAt),
    ])

    const csv = UTF8_BOM + buildCsv(header, body)
    const stamp = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Failed to export users:", error)
    return NextResponse.json(
      { error: "Failed to export users" },
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } },
    )
  }
}
