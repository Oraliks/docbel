import { UserRole, UserStatus } from "@prisma/client"

export const USER_ROLES: readonly UserRole[] = [
  UserRole.user,
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
