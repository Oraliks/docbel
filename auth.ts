import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { UserStatus } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const nextAuthSecret = process.env.NEXTAUTH_SECRET
const MAX_FAILED_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15

class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials"
}

class InactiveAccountError extends CredentialsSignin {
  code = "account_inactive"
}

class LockedAccountError extends CredentialsSignin {
  code = "account_locked"
}

if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is required")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new InvalidCredentialsError()
        }

        const email = String(credentials.email).trim().toLowerCase()
        const password = String(credentials.password)

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user) {
          throw new InvalidCredentialsError()
        }

        const now = new Date()
        const lockExpired = user.lockedUntil && user.lockedUntil <= now

        if (user.status === UserStatus.disabled || user.status === UserStatus.pending) {
          throw new InactiveAccountError()
        }

        if (user.status === UserStatus.locked && !lockExpired) {
          throw new LockedAccountError()
        }

        const passwordMatch = await bcrypt.compare(
          password,
          user.password
        )

        if (!passwordMatch) {
          const failedLoginAttempts = user.failedLoginAttempts + 1
          const shouldLock = failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS

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

          throw new InvalidCredentialsError()
        }

        const nextStatus = user.status === UserStatus.locked ? UserStatus.active : user.status

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: now,
            status: nextStatus,
          },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: nextStatus,
        }
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.name = user.name
        token.role = (user as { role?: string }).role
        token.status = (user as { status?: string }).status
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.name = token.name as string
        ;(session.user as { role?: unknown }).role = token.role
        ;(session.user as { status?: unknown }).status = token.status
      }
      return session
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: nextAuthSecret,
})
