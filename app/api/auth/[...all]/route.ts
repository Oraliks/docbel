import { auth } from "@/lib/auth"
import { withAuthRateLimit } from "@/lib/auth-rate-limit"
import { toNextJsHandler } from "better-auth/next-js"

export const runtime = "nodejs"
const handlers = toNextJsHandler(auth)
export const GET = withAuthRateLimit(handlers.GET)
export const POST = withAuthRateLimit(handlers.POST)
