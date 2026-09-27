import { isIP } from "node:net"
import { getTranslations } from "next-intl/server"
import { apiOk } from "@/lib/api/response"
import { rateLimitHeaders, tooManyRequests } from "@/lib/api/rate-limit-response"
import { checkRateLimit, getClientIp, type RateLimitOptions } from "@/lib/utils/rate-limit"

// Better Auth 1.6.9 defaults, including the magic-link plugin override. Keep
// finite scopes: paths, callback tokens and query strings must not create rows.
const RULES: Array<{ paths: string[]; options: RateLimitOptions }> = [
  { paths: ["/sign-in/magic-link", "/magic-link/verify"], options: { windowMs: 60_000, max: 5 } },
  { paths: ["/sign-in", "/sign-up", "/change-password", "/change-email"], options: { windowMs: 10_000, max: 3 } },
  { paths: ["/request-password-reset", "/send-verification-email", "/forget-password"], options: { windowMs: 60_000, max: 3 } },
  { paths: ["/get-session", "/reset-password", "/callback"], options: { windowMs: 10_000, max: 100 } },
]
const DEFAULT_OPTIONS = { windowMs: 10_000, max: 100 }

function requestScope(request: Request) {
  let path = "/"
  try {
    // Also coalesce encoded/case/slash variants conservatively, without
    // rewriting the original URL passed to Better Auth's own router.
    path = decodeURIComponent(new URL(request.url).pathname)
      .toLowerCase().replace(/\/+/g, "/").replace(/\/+$/, "")
  } catch { /* Malformed paths use the same bounded fallback scope. */ }
  if (path.startsWith("/api/auth/")) path = path.slice("/api/auth".length)
  for (const rule of RULES) {
    const scope = rule.paths.find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    if (scope) return { scope, options: rule.options }
  }
  return { scope: "/other", options: DEFAULT_OPTIONS }
}

function clientKey(request: Request) {
  // Deployment proxies must overwrite forwarded IP headers, as for the other
  // shared-limit routes. Missing/invalid IPs still receive a quota.
  const ip = getClientIp(request).trim()
  const version = isIP(ip)
  if (version === 4) return ip
  if (version === 6) {
    try { return new URL(`http://[${ip}]/`).hostname }
    catch { /* Scoped IPv6 forms are invalid in URL hosts: use the fallback. */ }
  }
  return "unknown"
}

async function limitResponse(limit: number, resetAt: number, unavailable = false) {
  const t = await getTranslations("public.auth")
  const message = t(unavailable ? "errAuthUnavailable" : "errRateLimited")
  if (unavailable) {
    return apiOk({ error: message, message, code: "auth_rate_limit_unavailable" }, {
      status: 503,
      headers: { ...rateLimitHeaders({ limit, remaining: 0, resetAt }), "Cache-Control": "no-store" },
    })
  }
  const response = tooManyRequests({ limit, resetAt, message })
  const headers = new Headers(response.headers)
  headers.delete("Content-Type") // apiOk sets the UTF-8 content type itself.
  // Better Auth's client reads `message`; preserve DocBel's `error` and `code`
  // convention too, so login/reset forms can display the translated refusal.
  return apiOk({ ...await response.json(), message }, {
    status: response.status,
    headers: { ...Object.fromEntries(headers), "Cache-Control": "no-store" },
  })
}

export function withAuthRateLimit(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const { scope, options } = requestScope(request)
    const result = await checkRateLimit(`auth-http:${scope}:${clientKey(request)}`, options)
    if (!result.ok) return limitResponse(options.max, result.resetAt, result.unavailable)

    // Do not read or clone the body: cookies, Origin, OAuth redirects and form
    // payloads must reach the native handler unchanged, after the atomic guard.
    const response = await handler(request)
    if (response.status === 429) {
      // The native limiter stays enabled as an additional defence. Version
      // 1.6.9 emits only X-Retry-After; expose the standard header to clients.
      const seconds = Number(response.headers.get("Retry-After") ?? response.headers.get("X-Retry-After"))
      const retryMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : options.windowMs
      const translated = await limitResponse(options.max, Date.now() + retryMs)
      response.headers.forEach((value, name) => {
        if (!translated.headers.has(name) && !["set-cookie", "content-length", "content-encoding"].includes(name)) {
          translated.headers.set(name, value)
        }
      })
      for (const cookie of response.headers.getSetCookie()) translated.headers.append("Set-Cookie", cookie)
      return translated
    }
    return response
  }
}
