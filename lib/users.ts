import { Prisma, UserRole, UserStatus } from "@prisma/client"

export const USER_ROLES: readonly UserRole[] = [
  UserRole.user,
  UserRole.partner,
  UserRole.employer,
  UserRole.moderator,
  UserRole.admin,
]

export const USER_STATUSES: readonly UserStatus[] = [
  UserStatus.active,
  UserStatus.pending,
  UserStatus.disabled,
  UserStatus.locked,
]

export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  segment: true,
  partnerType: true,
  partnerOrganization: true,
  vatNumber: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole)
}

export function isUserStatus(value: string): value is UserStatus {
  return USER_STATUSES.includes(value as UserStatus)
}

export function validatePassword(password: string) {
  if (password.length < 10) {
    return "Password must contain at least 10 characters"
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain lowercase, uppercase, and numeric characters"
  }

  return null
}

export function serializeUser<T extends {
  createdAt: Date
  updatedAt: Date
  emailVerifiedAt?: Date | null
  lastLoginAt?: Date | null
  passwordChangedAt?: Date | null
}>(user: T) {
  return {
    ...user,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

// ===========================================================================
// Requête liste admin (Lot 1 refonte users) : parsing des query params +
// construction du `where`/`orderBy` Prisma. Extrait ici pour être PARTAGÉ entre
// la page serveur (app/admin/users/page.tsx) et l'API (GET /api/users), et
// testé unitairement. Aucune valeur invalide ne lève d'erreur : on retombe
// toujours sur les défauts (une URL bidouillée ne casse pas la page admin).
// ===========================================================================

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
  const role = isUserRole(rawRole) ? rawRole : null

  const rawSegment = get("segment")
  const segment: UserSegmentFilter | null =
    rawSegment === "partenaire" ||
    rawSegment === "employeur" ||
    rawSegment === "none"
      ? rawSegment
      : null

  const rawStatus = get("status")
  const status = isUserStatus(rawStatus) ? rawStatus : null

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
