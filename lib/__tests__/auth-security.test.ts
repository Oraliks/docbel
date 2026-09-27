import { beforeEach, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { auth } from "@/lib/auth"

// Importer la configuration réelle sans initialiser Prisma ni toucher une DB.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/partner-domains", () => ({ isEmailAuthorized: vi.fn() }))

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = "admin@example.test"
const PASSWORD = "Fixture-password-123"
const LEGACY_HASH = "$2b$10$legacy-hash-fixture-never-a-real-password"

function cookieHeaders(response: Response, previous = new Headers()) {
  const jar = new Map(
    (previous.get("cookie") ?? "").split("; ").filter(Boolean).map((cookie) => {
      const index = cookie.indexOf("=")
      return [cookie.slice(0, index), cookie.slice(index + 1)] as const
    }),
  )
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0]
    const index = pair.indexOf("=")
    jar.set(pair.slice(0, index), pair.slice(index + 1))
  }
  return new Headers({ cookie: [...jar].map(([name, value]) => `${name}=${value}`).join("; ") })
}

function createFixture() {
  const database: Record<string, Record<string, unknown>[]> = {
    user: [], account: [], session: [], verification: [],
  }
  const instance = betterAuth({
    ...auth.options,
    baseURL: BASE_URL,
    secret: "auth-security-fixture-secret-not-for-production",
    database: memoryAdapter(database),
    trustedOrigins: [BASE_URL],
    socialProviders: undefined,
    // Les hooks de login interrogent Prisma : ce test isole la surface HTTP et
    // la sérialisation Better Auth avec son vrai adaptateur mémoire.
    hooks: undefined,
    rateLimit: { enabled: false },
    plugins: auth.options.plugins.filter((plugin) => plugin.id !== "next-cookies"),
  })
  return { database, instance }
}

describe("configuration Better Auth — frontières administratives", () => {
  let fixture: ReturnType<typeof createFixture>
  let adminHeaders: Headers

  beforeEach(async () => {
    fixture = createFixture()
    await fixture.instance.api.signUpEmail({
      body: { email: ADMIN_EMAIL, password: PASSWORD, name: "Admin fixture" },
    })
    Object.assign(fixture.database.user[0], { role: "admin", password: LEGACY_HASH })
    const signedIn = await fixture.instance.api.signInEmail({
      body: { email: ADMIN_EMAIL, password: PASSWORD },
      asResponse: true,
    })
    expect(signedIn.status).toBe(200)
    adminHeaders = cookieHeaders(signedIn)
  })

  it.each(["active", "disabled", "demoted"])(
    "ferme tous les endpoints natifs admin, même avec une session conservée (%s)",
    async (state) => {
      if (state === "disabled") fixture.database.user[0].status = "disabled"
      if (state === "demoted") fixture.database.user[0].role = "user"
      const plugin = auth.options.plugins.find((entry) => entry.id === "admin")!
      const endpoints = Object.values(plugin.endpoints!)
      expect(endpoints.length).toBeGreaterThan(10)
      for (const endpoint of endpoints) {
        const method = Array.isArray(endpoint.options.method)
          ? endpoint.options.method[0]
          : endpoint.options.method
        const response = await fixture.instance.handler(new Request(`${BASE_URL}/api/auth${endpoint.path}`, {
          method,
          headers: adminHeaders,
        }))
        expect(response.status, `${method} ${endpoint.path}`).toBe(404)
      }
      expect(fixture.database.user).toHaveLength(1)
    },
  )

  it("retire le hash des réponses HTTP de connexion et de session", async () => {
    const signedIn = await fixture.instance.handler(new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE_URL },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }),
    }))
    expect(signedIn.status).toBe(200)
    const signedInBody = await signedIn.json()
    expect(signedInBody.user).not.toHaveProperty("password")
    expect(JSON.stringify(signedInBody)).not.toContain(LEGACY_HASH)

    const session = await fixture.instance.handler(new Request(`${BASE_URL}/api/auth/get-session`, {
      headers: cookieHeaders(signedIn),
    }))
    expect(session.status).toBe(200)
    const sessionBody = await session.json()
    expect(sessionBody.user.email).toBe(ADMIN_EMAIL)
    expect(sessionBody.user).not.toHaveProperty("password")
    expect(JSON.stringify(sessionBody)).not.toContain(LEGACY_HASH)
  })

  it("refuse une session révoquée même avec un ancien cookie de cache encore valide", async () => {
    // Simule un cookie émis avant le déploiement de la désactivation du cache.
    const legacy = betterAuth({
      ...fixture.instance.options,
      session: { ...auth.options.session, cookieCache: { enabled: true, maxAge: 300 } },
    })
    const signedIn = await legacy.api.signInEmail({
      body: { email: ADMIN_EMAIL, password: PASSWORD }, asResponse: true,
    })
    const legacyHeaders = cookieHeaders(signedIn)
    expect(legacyHeaders.get("cookie")).toContain("session_data=")

    fixture.database.session.splice(0)
    // Preuve que ce même cookie serait encore accepté par l'ancienne config.
    const cached = await legacy.api.getSession({ headers: legacyHeaders })
    expect(cached?.user.email).toBe(ADMIN_EMAIL)

    const response = await fixture.instance.handler(new Request(`${BASE_URL}/api/auth/get-session`, {
      headers: legacyHeaders,
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toBeNull()
  })

  it("préserve l'impersonation et son arrêt via l'API serveur, sans exposer le hash", async () => {
    const target = await fixture.instance.api.signUpEmail({
      body: { email: "target@example.test", password: PASSWORD, name: "Target fixture" },
    })
    fixture.database.user.find((user) => user.id === target.user.id)!.password = LEGACY_HASH
    const impersonation = await fixture.instance.api.impersonateUser({
      body: { userId: target.user.id }, headers: adminHeaders, asResponse: true,
    })
    expect(impersonation.status).toBe(200)
    const impersonated = await impersonation.json()
    expect(impersonated.user.id).toBe(target.user.id)
    expect(impersonated.user).not.toHaveProperty("password")
    expect(impersonated.session.impersonatedBy).toBe(fixture.database.user[0].id)

    const stopped = await fixture.instance.api.stopImpersonating({
      headers: cookieHeaders(impersonation, adminHeaders), asResponse: true,
    })
    expect(stopped.status).toBe(200)
    const restored = await stopped.json()
    expect(restored.user.email).toBe(ADMIN_EMAIL)
    expect(restored.user).not.toHaveProperty("password")
    expect(fixture.database.session.some((session) => session.impersonatedBy)).toBe(false)
  })
})
