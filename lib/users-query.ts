// Logique de requête de la liste users admin — CLIENT-SAFE : uniquement des
// imports de TYPES depuis @prisma/client (aucune valeur → pas de PrismaClient
// tiré dans le bundle navigateur). Partagé entre la page serveur, l'API et le
// composant client de la liste (users-list-client). lib/users.ts en ré-exporte
// tout pour le confort côté serveur.

import type { Prisma, UserRole, UserStatus } from "@prisma/client"

// Valeurs autorisées en littéraux (pas d'import de l'enum-valeur @prisma/client).
const ROLE_VALUES = [
  "user",
  "partner",
  "employer",
  "moderator",
  "admin",
] as const satisfies readonly UserRole[]

const STATUS_VALUES = [
  "active",
  "pending",
  "locked",
  "disabled",
] as const satisfies readonly UserStatus[]

function isRole(value: string): value is UserRole {
  return (ROLE_VALUES as readonly string[]).includes(value)
}

function isStatus(value: string): value is UserStatus {
  return (STATUS_VALUES as readonly string[]).includes(value)
}

/// Tri autorisé (préfixe "-" = ordre décroissant). Défaut = "-createdAt".
export const USER_LIST_SORTS = [
  "createdAt",
  "-createdAt",
  "name",
  "-name",
  "lastLoginAt",
  "-lastLoginAt",
] as const

export type UserListSort = (typeof USER_LIST_SORTS)[number]

/// Tailles de page autorisées (bornage : jamais de `take` arbitraire).
export const USER_PAGE_SIZES = [10, 20, 50, 100] as const

export const DEFAULT_USER_PAGE_SIZE = 20
export const DEFAULT_USER_SORT: UserListSort = "-createdAt"

/// Filtre segment : "none" = compte SANS segment (legacy/admin/citoyen).
export type UserSegmentFilter = "partenaire" | "employeur" | "none"

export interface UsersQuery {
  q: string
  role: UserRole | null
  segment: UserSegmentFilter | null
  status: UserStatus | null
  sort: UserListSort
  page: number
  pageSize: number
}

/// Accepte soit un URLSearchParams, soit l'objet `searchParams` d'une page Next
/// (valeurs string | string[] | undefined). Renvoie une requête normalisée.
/// Aucune valeur invalide ne lève : on retombe toujours sur les défauts.
export function parseUsersQuery(
  input:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
): UsersQuery {
  const get = (key: string): string => {
    if (!input) return ""
    if (input instanceof URLSearchParams) return input.get(key) ?? ""
    const v = input[key]
    if (Array.isArray(v)) return v[0] ?? ""
    return v ?? ""
  }

  const rawRole = get("role")
  const role = isRole(rawRole) ? rawRole : null

  const rawSegment = get("segment")
  const segment: UserSegmentFilter | null =
    rawSegment === "partenaire" ||
    rawSegment === "employeur" ||
    rawSegment === "none"
      ? rawSegment
      : null

  const rawStatus = get("status")
  const status = isStatus(rawStatus) ? rawStatus : null

  const rawSort = get("sort")
  const sort = (USER_LIST_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as UserListSort)
    : DEFAULT_USER_SORT

  const rawPage = Number.parseInt(get("page"), 10)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

  const rawPageSize = Number.parseInt(get("pageSize"), 10)
  const pageSize = (USER_PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_USER_PAGE_SIZE

  return {
    q: get("q").trim(),
    role,
    segment,
    status,
    sort,
    page,
    pageSize,
  }
}

/// `where` Prisma dérivé des filtres (hors pagination/tri). `q` cherche sur
/// name + email (insensible à la casse).
export function buildUsersWhere(query: UsersQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}

  if (query.role) where.role = query.role
  if (query.status) where.status = query.status

  if (query.segment === "none") {
    where.segment = null
  } else if (query.segment) {
    where.segment = query.segment
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ]
  }

  return where
}

/// `orderBy` Prisma dérivé du tri. Les valeurs null (ex: lastLoginAt jamais
/// connecté) sont poussées en fin de liste via `nulls: "last"`.
export function buildUsersOrderBy(
  sort: UserListSort,
): Prisma.UserOrderByWithRelationInput {
  const desc = sort.startsWith("-")
  const field = (desc ? sort.slice(1) : sort) as
    | "createdAt"
    | "name"
    | "lastLoginAt"
  const dir: Prisma.SortOrder = desc ? "desc" : "asc"

  if (field === "lastLoginAt") {
    return { lastLoginAt: { sort: dir, nulls: "last" } }
  }
  return { [field]: dir }
}

/// Sérialise la requête en querystring canonique (omet les valeurs par défaut)
/// pour piloter l'URL de la liste. Utilisé côté client (router.replace) et pour
/// construire les liens d'export.
export function usersQueryToSearchParams(
  query: Partial<UsersQuery>,
): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.role) params.set("role", query.role)
  if (query.segment) params.set("segment", query.segment)
  if (query.status) params.set("status", query.status)
  if (query.sort && query.sort !== DEFAULT_USER_SORT) {
    params.set("sort", query.sort)
  }
  if (query.page && query.page > 1) params.set("page", String(query.page))
  if (query.pageSize && query.pageSize !== DEFAULT_USER_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize))
  }
  return params
}
