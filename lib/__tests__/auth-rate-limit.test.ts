import { beforeEach, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { magicLink } from "better-auth/plugins/magic-link"
import { createAuthClient } from "better-auth/client"
import { GET, POST } from "@/app/api/auth/[...all]/route"
import { checkRateLimit } from "@/lib/utils/rate-limit"
import { createMemoryRateLimiter } from "@/lib/utils/rate-limit-core"

const nativeHandler = vi.hoisted(() => vi.fn<(request: Request) => Promise<Response>>())
vi.mock("@/lib/auth", () => ({ auth: { handler: nativeHandler } }))
vi.mock("@/lib/utils/rate-limit", async (original) => ({
  ...await original<typeof import("@/lib/utils/rate-limit")>(),
  checkRateLimit: vi.fn(),
}))
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => `translated:${key}`),
}))

const BASE_URL = "http://localhost:3000"
const IP = "198.51.100.17"
const check = vi.mocked(checkRateLimit)

function request(path: string, method = "GET", headers: HeadersInit = {}) {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    method,
    headers: { Origin: BASE_URL, ...headers },
  })
}

beforeEach(() => {
  check.mockReset().mockResolvedValue({ ok: true, remaining: 2, resetAt: Date.now() + 10_000 })
  nativeHandler.mockReset().mockResolvedValue(new Response("delegated"))
})

describe("garde HTTP Better Auth — quotas partagés avant délégation", () => {
  it.each([GET, POST])("protège aussi les visiteurs anonymes sans IP, sans lire le corps (%#)", async (route) => {
    check.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 10_000 })
    const req = request("/sign-in/email", route === POST ? "POST" : "GET")
    const response = await route(req)
    expect(response.status).toBe(429)
    expect(check).toHaveBeenCalledWith("auth-http:/sign-in:unknown", { windowMs: 10_000, max: 3 })
    expect(nativeHandler).not.toHaveBeenCalled()
    expect(req.bodyUsed).toBe(false)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(response.headers.get("x-ratelimit-limit")).toBe("3")
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0")
    expect(await response.json()).toEqual({
      error: "translated:errRateLimited", message: "translated:errRateLimited", code: "rate_limited",
    })
  })

  it("attend le résultat du limiteur avant tout appel Better Auth", async () => {
    let allow!: (value: Awaited<ReturnType<typeof checkRateLimit>>) => void
    check.mockReturnValue(new Promise((resolve) => { allow = resolve }))
    const pending = GET(request("/get-session"))
    expect(nativeHandler).not.toHaveBeenCalled()
    allow({ ok: true, remaining: 99, resetAt: Date.now() + 10_000 })
    expect((await pending).status).toBe(200)
    expect(nativeHandler).toHaveBeenCalledOnce()
  })

  it("renvoie 503 et Retry-After en panne du backend sans appeler l'auth", async () => {
    check.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 5_000, unavailable: true })
    const response = await POST(request("/sign-in/email", "POST"))
    expect(response.status).toBe(503)
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toMatchObject({
      code: "auth_rate_limit_unavailable", message: "translated:errAuthUnavailable",
    })
    expect(nativeHandler).not.toHaveBeenCalled()
  })

  it("transmet la requête originale, corps, cookies et redirection compris", async () => {
    const payload = JSON.stringify({ email: "fixture@example.test", password: "synthetic-password" })
    const req = new Request(`${BASE_URL}/api/auth/sign-in/email?callbackURL=%2Fadmin`, {
      method: "POST",
      headers: { "content-type": "application/json", Origin: BASE_URL, Cookie: "fixture=session" },
      body: payload,
    })
    const response = new Response(null, { status: 302, headers: { Location: "/admin", "Set-Cookie": "fixture=new; HttpOnly" } })
    nativeHandler.mockImplementation(async (received) => {
      expect(received).toBe(req)
      expect(received.headers.get("cookie")).toBe("fixture=session")
      expect(received.headers.get("origin")).toBe(BASE_URL)
      expect(await received.text()).toBe(payload)
      return response
    })
    expect(await POST(req)).toBe(response)
  })

  it.each([
    ["/get-session", 100, 10_000],
    ["/sign-in/email", 3, 10_000],
    ["/sign-up/email", 3, 10_000],
    ["/change-password", 3, 10_000],
    ["/change-email", 3, 10_000],
    ["/request-password-reset", 3, 60_000],
    ["/send-verification-email", 3, 60_000],
    ["/forget-password", 3, 60_000],
    ["/sign-in/magic-link", 5, 60_000],
    ["/magic-link/verify?token=synthetic", 5, 60_000],
    ["/reset-password/synthetic-token", 100, 10_000],
    ["/callback/google?code=synthetic", 100, 10_000],
    ["/sign-out", 100, 10_000],
  ])("conserve les quotas Better Auth pour %s", async (path, max, windowMs) => {
    await GET(request(path))
    expect(check).toHaveBeenCalledWith(expect.any(String), { max, windowMs })
  })

  it("rassemble variantes, méthodes et requêtes sans stocker de token/query dans la clé", async () => {
    for (const path of ["/sign-in/email", "/sign-in/email///?new=1", "/%73ign-in/email", "/SIGN-IN//EMAIL"]) {
      await POST(request(path, "POST", { "x-forwarded-for": `${IP}, 10.0.0.1` }))
    }
    await GET(request("/sign-in/email", "GET", { "x-real-ip": IP }))
    expect(new Set(check.mock.calls.map(([key]) => key))).toEqual(new Set([`auth-http:/sign-in:${IP}`]))
    check.mockClear()
    await GET(request("/reset-password/token-one?email=fixture@example.test"))
    await GET(request("/reset-password/token-two?email=other@example.test"))
    expect(new Set(check.mock.calls.map(([key]) => key))).toEqual(new Set(["auth-http:/reset-password:unknown"]))
  })

  it("borne les scopes inconnus et IP malformées plutôt que de créer des clés arbitraires", async () => {
    for (let index = 0; index < 100; index++) {
      await GET(request(`/unknown-${index}?token=${index}`, "GET", { "x-forwarded-for": `not-an-ip-${index}` }))
    }
    await GET(request("/%ZZ"))
    expect((await GET(request("/unknown", "GET", { "x-real-ip": "fe80::1%eth0" }))).status).toBe(200)
    expect(new Set(check.mock.calls.map(([key]) => key))).toEqual(new Set(["auth-http:/other:unknown"]))
  })

  it("normalise les écritures IPv6 et sépare deux IP valides", async () => {
    for (const ip of ["2001:db8::1", "2001:0DB8:0000:0000:0000:0000:0000:0001", IP, "198.51.100.18"]) {
      await GET(request("/get-session", "GET", { "x-real-ip": ip }))
    }
    const keys = check.mock.calls.map(([key]) => key)
    expect(keys[0]).toBe(keys[1])
    expect(new Set(keys).size).toBe(3)
  })

  it("plafonne les appels concurrents avant le handler et laisse get-session utilisable", async () => {
    const limiter = createMemoryRateLimiter("auth-http-synthetic-test-secret")
    check.mockImplementation((key, options) => limiter.check(key, options))
    const responses = await Promise.all(Array.from({ length: 30 }, (_, index) => {
      return index % 2 ? POST(request("/sign-in/email", "POST")) : GET(request("/sign-in/email"))
    }))
    expect(responses.filter((response) => response.status === 200)).toHaveLength(3)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(27)
    expect(nativeHandler).toHaveBeenCalledTimes(3)
    expect((await GET(request("/get-session"))).status).toBe(200)
  })

  it("ajoute Retry-After aux refus du limiteur natif qui reste actif", async () => {
    const headers = new Headers({ "X-Retry-After": "45", "Access-Control-Allow-Origin": BASE_URL, "Content-Length": "999" })
    headers.append("Set-Cookie", "one=1; HttpOnly")
    headers.append("Set-Cookie", "two=2; HttpOnly")
    nativeHandler.mockResolvedValue(new Response(JSON.stringify({ message: "Too many requests" }), { status: 429, headers }))
    const response = await GET(request("/get-session"))
    expect(response.status).toBe(429)
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThanOrEqual(44)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(BASE_URL)
    expect(response.headers.getSetCookie()).toEqual(["one=1; HttpOnly", "two=2; HttpOnly"])
    expect(response.headers.has("content-length")).toBe(false)
    expect(await response.json()).toMatchObject({ message: "translated:errRateLimited" })
  })

  it("reste compatible avec l'erreur reçue par le vrai client Better Auth", async () => {
    check.mockResolvedValue({ ok: false, remaining: 0, resetAt: Date.now() + 10_000 })
    const client = createAuthClient({ baseURL: BASE_URL, fetchOptions: {
      customFetchImpl: async (input, init) => POST(new Request(input, init)),
    } })
    const result = await client.signIn.email({ email: "fixture@example.test", password: "synthetic-password" })
    expect(result.data).toBeNull()
    expect(result.error).toMatchObject({ status: 429, code: "rate_limited", message: "translated:errRateLimited" })
  })
})

describe("garde HTTP — parcours natifs Better Auth sur adaptateur mémoire", () => {
  it("préserve connexion, lecture session, récupération et magic-link sans service externe", async () => {
    let resetUrl = ""
    let magicUrl = ""
    const instance = betterAuth({
      baseURL: BASE_URL,
      secret: "auth-http-fixture-secret-not-for-production",
      database: memoryAdapter({ user: [], account: [], session: [], verification: [] }),
      trustedOrigins: [BASE_URL],
      rateLimit: { enabled: true },
      emailAndPassword: { enabled: true, sendResetPassword: async ({ url }) => { resetUrl = url } },
      plugins: [magicLink({ sendMagicLink: async ({ url }) => { magicUrl = url } })],
    })
    const email = "auth-http@example.test"
    const password = "Synthetic-password-123"
    await instance.api.signUpEmail({ body: { email, password, name: "Fixture" } })
    nativeHandler.mockImplementation(instance.handler)
    const post = (path: string, data: unknown) => POST(new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST", headers: { Origin: BASE_URL, "content-type": "application/json", "x-real-ip": IP },
      body: JSON.stringify(data),
    }))
    const signedIn = await post("/sign-in/email", { email, password })
    expect(signedIn.status).toBe(200)
    const cookie = signedIn.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ")
    const session = await GET(request("/get-session", "GET", { Cookie: cookie, "x-real-ip": IP }))
    expect(session.status).toBe(200)
    expect((await session.json()).user.email).toBe(email)
    expect((await post("/request-password-reset", { email, redirectTo: `${BASE_URL}/reinitialiser-mot-de-passe` })).status).toBe(200)
    expect(resetUrl).toContain("/reset-password/")
    const resetRedirect = await GET(new Request(resetUrl, { headers: { "x-real-ip": IP } }))
    expect(resetRedirect.status).toBe(302)
    const resetToken = new URL(resetRedirect.headers.get("location")!).searchParams.get("token")
    expect((await post("/reset-password", { token: resetToken, newPassword: `${password}-changed` })).status).toBe(200)
    expect((await post("/sign-in/email", { email, password: `${password}-changed` })).status).toBe(200)
    expect((await post("/sign-in/magic-link", { email })).status).toBe(200)
    const verified = await GET(new Request(magicUrl, { headers: { "x-real-ip": IP } }))
    expect([200, 302]).toContain(verified.status)
    expect(verified.headers.getSetCookie().length).toBeGreaterThan(0)
  })
})
