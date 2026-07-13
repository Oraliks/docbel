import { prisma } from "@/lib/prisma"
import {
  buildUsersOrderBy,
  buildUsersWhere,
  parseUsersQuery,
  SAFE_USER_SELECT,
  serializeUser,
} from "@/lib/users"
import {
  UsersListClient,
  type UsersListUser,
} from "@/components/admin/users/users-list-client"

export const dynamic = "force-dynamic"

// Server Component : pagination + filtres + tri sont désormais résolus CÔTÉ
// SERVEUR (fin du `take: 1000` filtré client). L'état des filtres vit dans
// l'URL (searchParams), ce qui rend la vue partageable/bookmarkable. Les
// stat-cards globales sont calculées indépendamment des filtres actifs.
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = parseUsersQuery(await searchParams)
  const where = buildUsersWhere(query)

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

  // Stats globales (tout le parc, hors filtres) : agrégats groupBy plutôt que
  // de charger toutes les lignes en mémoire. Hors transaction (pas besoin de
  // cohérence transactionnelle avec la page affichée).
  const [byStatus, byRole] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ])

  const statusCount = (s: string) =>
    byStatus.find((g) => g.status === s)?._count._all ?? 0
  const roleCount = (r: string) =>
    byRole.find((g) => g.role === r)?._count._all ?? 0
  const grandTotal = byStatus.reduce((sum, g) => sum + g._count._all, 0)
  const active = statusCount("active")

  const stats = {
    total: grandTotal,
    active,
    inactive: grandTotal - active,
    admin: roleCount("admin"),
    employer: roleCount("employer"),
    partner: roleCount("partner"),
    user: roleCount("user"),
  }

  const users: UsersListUser[] = rows.map(serializeUser).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    segment:
      u.segment === "partenaire" || u.segment === "employeur"
        ? u.segment
        : null,
    partnerType: u.partnerType,
    partnerOrganization: u.partnerOrganization ?? null,
    vatNumber: u.vatNumber ?? null,
    emailVerifiedAt: u.emailVerifiedAt,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }))

  return (
    <UsersListClient
      users={users}
      stats={stats}
      total={total}
      page={query.page}
      pageSize={query.pageSize}
      query={{
        q: query.q,
        role: query.role,
        segment: query.segment,
        status: query.status,
        sort: query.sort,
      }}
    />
  )
}
