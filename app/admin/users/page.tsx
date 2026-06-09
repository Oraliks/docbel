import { prisma } from "@/lib/prisma"
import { SAFE_USER_SELECT, serializeUser } from "@/lib/users"
import {
  UsersListClient,
  type UsersListUser,
} from "@/components/admin/users/users-list-client"

export const dynamic = "force-dynamic"

// Server Component : la liste (lecture seule, navigation par <Link>) est rendue
// côté serveur. `take: 1000` (convention AGENTS) + SAFE_USER_SELECT partagé avec
// /api/users. L'attente est couverte par app/admin/loading.tsx (skeleton table).
export default async function UsersPage() {
  const rows = await prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: { createdAt: "desc" },
    take: 1000,
  })

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
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }))

  return <UsersListClient users={users} />
}
