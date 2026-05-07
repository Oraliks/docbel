import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { createAuthMiddleware, APIError } from "better-auth/api"
import * as bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserStatus } from "@prisma/client"

const authSecret = process.env.BETTER_AUTH_SECRET

if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET is required")
}

const MAX_FAILED_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15

const SIGN_IN_PATH = "/sign-in/email"

async function getCanonicalUser(email: string) {
  const normalized = email.trim().toLowerCase()
  return prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      status: true,
      lockedUntil: true,
      failedLoginAttempts: true,
    },
  })
}

async function recordFailedAttempt(user: {
  id: string
  status: UserStatus
  lockedUntil: Date | null
  failedLoginAttempts: number
}) {
  const failedLoginAttempts = user.failedLoginAttempts + 1
  const shouldLock = failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
  const now = new Date()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts,
      status: shouldLock ? UserStatus.locked : user.status,
      lockedUntil: shouldLock
        ? new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000)
        : user.lockedUntil,
    },
  })
}

async function recordSuccessfulSignIn(userId: string, currentStatus: UserStatus) {
  const nextStatus = currentStatus === UserStatus.locked ? UserStatus.active : currentStatus
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      status: nextStatus,
    },
  })
}

export const auth = betterAuth({
  appName: "Docbel",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: authSecret,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  trustedOrigins:
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) || [],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: async (password) => bcrypt.hash(password, 10),
      verify: async ({ password, hash }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "user" },
      status: { type: "string", input: false, defaultValue: "active" },
      password: { type: "string", input: false, required: false, defaultValue: "" },
      passwordChangedAt: { type: "date", input: false, required: false },
      lastLoginAt: { type: "date", input: false, required: false },
      failedLoginAttempts: { type: "number", input: false, defaultValue: 0 },
      lockedUntil: { type: "date", input: false, required: false },
      emailVerifiedAt: { type: "date", input: false, required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return

      const email = (ctx.body as { email?: unknown } | undefined)?.email
      if (typeof email !== "string" || email.length === 0) return

      const user = await getCanonicalUser(email)
      if (!user) {
        throw new APIError("UNAUTHORIZED", {
          message: "Email ou mot de passe incorrect",
          code: "invalid_credentials",
        })
      }

      const now = new Date()
      const lockExpired = user.lockedUntil ? user.lockedUntil <= now : true

      if (user.status === UserStatus.disabled || user.status === UserStatus.pending) {
        throw new APIError("FORBIDDEN", {
          message: "Compte inactif",
          code: "account_inactive",
        })
      }

      if (user.status === UserStatus.locked && !lockExpired) {
        throw new APIError("FORBIDDEN", {
          message: "Compte temporairement verrouille",
          code: "account_locked",
        })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return

      const email = (ctx.body as { email?: unknown } | undefined)?.email
      if (typeof email !== "string") return

      const user = await getCanonicalUser(email)
      if (!user) return

      const newSession = ctx.context.newSession
      const succeeded = Boolean(newSession?.user?.id && newSession.user.id === user.id)

      if (succeeded) {
        await recordSuccessfulSignIn(user.id, user.status)
      } else {
        await recordFailedAttempt(user)
      }
    }),
  },
  plugins: [nextCookies()],
})

export type Auth = typeof auth
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
