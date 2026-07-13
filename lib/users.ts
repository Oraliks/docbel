import { UserRole, UserStatus } from "@prisma/client"
import { normalizeBelgianTVA } from "@/lib/pdf-forms/validators"

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

// Sous-types partenaire autorisés (cf. User.partnerType). Bornés ici pour
// valider la saisie admin.
export const PARTNER_TYPES = [
  "onem",
  "organisme_paiement",
  "service_public",
  "prive_asbl",
] as const

export type PartnerType = (typeof PARTNER_TYPES)[number]

export function isPartnerType(value: string): value is PartnerType {
  return (PARTNER_TYPES as readonly string[]).includes(value)
}

/// Segment de COMPTE (les citoyens n'ont pas de compte → pas de "citoyen").
export function isAccountSegment(value: string): value is "partenaire" | "employeur" {
  return value === "partenaire" || value === "employeur"
}

/// Champs liés au segment d'un compte, normalisés de façon cohérente.
export interface UserSegmentFields {
  segment: string | null
  partnerType: string | null
  vatNumber: string | null
  partnerOrganization: string | null
  isOrgManager: boolean
  canViewRdvHistory: boolean
}

export interface UserSegmentInput {
  segment?: string | null
  partnerType?: string | null
  vatNumber?: string | null
  partnerOrganization?: string | null
  isOrgManager?: boolean
  canViewRdvHistory?: boolean
}

/// Normalise les champs dépendants du segment et garantit leur cohérence
/// (fonction PURE, testée) :
///   - segment "employeur"  → TVA obligatoire+valide (mod-97), partnerType null,
///     flags RDV à false.
///   - segment "partenaire" → partnerType optionnel mais validé, TVA null.
///   - pas de segment       → tout est remis à null/false.
/// Retourne { ok:false, error } si la TVA employeur ou le partnerType est invalide.
export function resolveUserSegmentFields(
  input: UserSegmentInput,
): { ok: true; fields: UserSegmentFields } | { ok: false; error: string } {
  const rawSegment =
    typeof input.segment === "string" && isAccountSegment(input.segment)
      ? input.segment
      : null

  const org =
    typeof input.partnerOrganization === "string" &&
    input.partnerOrganization.trim()
      ? input.partnerOrganization.trim()
      : null

  if (rawSegment === "employeur") {
    const vat = normalizeBelgianTVA(
      typeof input.vatNumber === "string" ? input.vatNumber : "",
    )
    if (!vat) {
      return { ok: false, error: "Numéro de TVA belge invalide (BE + 10 chiffres)" }
    }
    return {
      ok: true,
      fields: {
        segment: "employeur",
        partnerType: null,
        vatNumber: vat,
        partnerOrganization: org,
        isOrgManager: false,
        canViewRdvHistory: false,
      },
    }
  }

  if (rawSegment === "partenaire") {
    let partnerType: string | null = null
    if (typeof input.partnerType === "string" && input.partnerType.trim()) {
      if (!isPartnerType(input.partnerType)) {
        return { ok: false, error: "Type de partenaire invalide" }
      }
      partnerType = input.partnerType
    }
    return {
      ok: true,
      fields: {
        segment: "partenaire",
        partnerType,
        vatNumber: null,
        partnerOrganization: org,
        isOrgManager: Boolean(input.isOrgManager),
        canViewRdvHistory: Boolean(input.canViewRdvHistory),
      },
    }
  }

  // Aucun segment : compte legacy/admin/citoyen — on nettoie tout.
  return {
    ok: true,
    fields: {
      segment: null,
      partnerType: null,
      vatNumber: null,
      partnerOrganization: org,
      isOrgManager: false,
      canViewRdvHistory: false,
    },
  }
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

// Logique de requête de la liste (parse/where/orderBy/querystring) extraite
// dans lib/users-query.ts (CLIENT-SAFE, imports @prisma/client type-only) pour
// pouvoir être importée par le composant client de la liste sans tirer
// PrismaClient dans le bundle. Ré-exportée ici pour le confort côté serveur.
export {
  USER_LIST_SORTS,
  USER_PAGE_SIZES,
  DEFAULT_USER_PAGE_SIZE,
  DEFAULT_USER_SORT,
  parseUsersQuery,
  buildUsersWhere,
  buildUsersOrderBy,
  usersQueryToSearchParams,
} from "./users-query"
export type {
  UserListSort,
  UserSegmentFilter,
  UsersQuery,
} from "./users-query"
