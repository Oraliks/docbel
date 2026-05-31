import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins/magic-link"
import { createAuthMiddleware, APIError } from "better-auth/api"
import * as bcrypt from "bcryptjs"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { isEmailAuthorized } from "@/lib/partner-domains"
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

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const googleEnabled = Boolean(googleClientId && googleClientSecret)

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
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          mapProfileToUser: async (profile) => {
            const email = profile.email?.trim().toLowerCase()
            if (!email) {
              throw new APIError("BAD_REQUEST", {
                message: "Adresse email manquante",
                code: "missing_email",
              })
            }

            const existing = await prisma.user.findUnique({
              where: { email },
              select: { id: true, role: true, partnerOrganization: true },
            })

            if (existing) {
              if (existing.role !== "partner" && existing.role !== "employer") {
                throw new APIError("FORBIDDEN", {
                  message:
                    "Ce compte n'est pas un compte partenaire. Connectez-vous avec votre mot de passe.",
                  code: "not_partner_account",
                })
              }
              return {
                name: profile.name ?? email,
                email,
              }
            }

            const authorization = await isEmailAuthorized(email)
            if (!authorization.authorized || !authorization.organizationName) {
              throw new APIError("FORBIDDEN", {
                message:
                  "Ce domaine email n'est pas autorisé pour l'inscription partenaire. Contactez DocBel.",
                code: "domain_not_authorized",
              })
            }

            const role =
              authorization.segment === "employeur" ? "employer" : "partner"

            return {
              name: profile.name ?? email,
              email,
              role,
              segment: authorization.segment ?? "partenaire",
              partnerType: authorization.partnerType ?? null,
              status: UserStatus.active,
              partnerOrganization: authorization.organizationName,
            } as Record<string, unknown>
          },
        },
      }
    : undefined,
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "user" },
      segment: { type: "string", input: false, required: false },
      partnerType: { type: "string", input: false, required: false },
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
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const apiKey = process.env.RESEND_API_KEY
        const from = process.env.EMAIL_FROM
        if (!apiKey || !from) {
          throw new Error(
            "RESEND_API_KEY ou EMAIL_FROM non configurés — magic link impossible",
          )
        }

        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: { role: true, status: true },
        })
        if (!user || user.role !== "partner") {
          throw new APIError("FORBIDDEN", {
            message: "Magic link réservé aux comptes partenaires actifs",
            code: "magic_link_not_allowed",
          })
        }
        if (user.status !== UserStatus.active) {
          throw new APIError("FORBIDDEN", {
            message: "Compte inactif — confirmez votre email d'abord",
            code: "account_inactive",
          })
        }

        const resend = new Resend(apiKey)
        const result = await resend.emails.send({
          from,
          to: email,
          subject: "Votre lien de connexion DocBel",
          text: [
            "Bonjour,",
            "",
            "Cliquez sur le lien ci-dessous pour vous connecter à DocBel (valide 15 minutes) :",
            "",
            url,
            "",
            "Si vous n'avez pas demandé ce lien, ignorez cet email.",
            "",
            "L'équipe DocBel",
          ].join("\n"),
        })
        if (result.error) {
          throw new Error(result.error.message || "Échec d'envoi du magic link")
        }
      },
    }),
    nextCookies(),
  ],
})

export type Auth = typeof auth
export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>
