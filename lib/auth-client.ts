import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"
import { magicLinkClient } from "better-auth/client/plugins"
import type { auth } from "@/lib/auth"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient()],
})

export const { useSession, signIn, signOut, signUp, getSession } = authClient
