import { beforeEach, describe, expect, it, vi } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { POST as registerPartner } from "@/app/api/inscription/partenaire/route"
import { POST as registerOrganization } from "@/app/api/formations/organismes/route"

const mocks = vi.hoisted(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "fixture-google-client")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture-google-secret")
  vi.stubEnv("RESEND_API_KEY", "fixture-resend-key")
  vi.stubEnv("EMAIL_FROM", "noreply@example.test")
  return { findUnique: vi.fn(), update: vi.fn(), sendEmail: vi.fn(), authorize: vi.fn() }
})
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock("@/lib/partner-domains", () => ({ isEmailAuthorized: mocks.authorize }))
vi.mock("resend", () => ({
  Resend: class { emails = { send: mocks.sendEmail } },
}))

const BASE_URL = "http://localhost:3000"
const ADMIN_EMAIL = "admin@example.test"
const PASSWORD = "Fixture-password-123"

function request(path: string, body?: unknown, cookie?: string) {
  return new Request(`${BASE_URL}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL, ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
// Google conserve son vrai getUserInfo/mapProfileToUser ; seul le transport de
// vérification cryptographique est remplacé dans cette fixture sans réseau.
function googleToken(email: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ sub: "fixture-google-id", email, name: "Fixture", email_verified: true })).toString("base64url")
  return `${header}.${payload}.fixture-signature`
}
function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ")
}

async function fixture() {
  const database: Record<string, Record<string, unknown>[]> = {
    user: [], account: [], session: [], verification: [],
  }
  mocks.findUnique.mockImplementation(async ({ where }) =>
    database.user.find((user) => where.email ? user.email === where.email : user.id === where.id) ?? null,
  )
  mocks.update.mockImplementation(async ({ where, data }) => {
    const user = database.user.find((entry) => entry.id === where.id)!
    return Object.assign(user, data)
  })
  mocks.authorize.mockResolvedValue({ authorized: true, organizationName: "Fixture", segment: "partenaire" })
  mocks.sendEmail.mockResolvedValue({ data: { id: "fixture-email" }, error: null })
  const google = auth.options.socialProviders?.google
  if (!google || typeof google !== "object") throw new Error("Google fixture not configured")
  const instance = betterAuth({
    ...auth.options,
    baseURL: BASE_URL,
    secret: "public-signup-fixture-secret-not-for-production",
    database: memoryAdapter(database),
    trustedOrigins: [BASE_URL],
    rateLimit: { enabled: false },
    // Real policy and hooks; only provider transport, Prisma and email are local doubles.
    socialProviders: { google: {
      ...google,
      verifyIdToken: async () => true,

    } },
    plugins: auth.options.plugins.filter((plugin) => plugin.id !== "next-cookies"),
  })
  // Internal setup for a pre-existing account: the HTTP signup remains closed.
  await instance.api.signUpEmail({ body: { email: ADMIN_EMAIL, password: PASSWORD, name: "Admin fixture" } })
  Object.assign(database.user[0], { role: "admin", status: "active" })
  database.session.splice(0)
  return { database, instance }
}

beforeEach(() => vi.clearAllMocks())

describe("V1 — fermeture des créations publiques, accès existants conservés", () => {
  it.each(["/sign-up/email", "/sign-up/email/", "/sign-up/email?callbackURL=/admin"])(
    "refuse %s avant toute création de compte ou session", async (path) => {
      const { database, instance } = await fixture()
      const response = await instance.handler(request(path, {
        email: "visitor@example.test", password: PASSWORD, name: "Visitor", role: "admin",
      }))
      expect(response.status).toBe(404)
      expect(database.user).toHaveLength(1)
      expect(database.account).toHaveLength(1)
      expect(database.session).toHaveLength(0)
      expect(response.headers.getSetCookie()).toHaveLength(0)
    },
  )

  it.each([false, true])("refuse la création Google, même requestSignUp=%s", async (requestSignUp) => {
    const { database, instance } = await fixture()
    const response = await instance.handler(request("/sign-in/social", {
      provider: "google", idToken: { token: googleToken("new@example.test") }, requestSignUp,
    }))
    expect(response.status).toBe(403)
    expect(database.user).toHaveLength(1)
    expect(database.account).toHaveLength(1)
    expect(database.session).toHaveLength(0)
  })

  it("conserve la connexion Google d'un compte professionnel existant", async () => {
    const email = "partner@example.test"
    const { database, instance } = await fixture()
    const user = await instance.api.signUpEmail({ body: { email, password: PASSWORD, name: "Partner" } })
    Object.assign(database.user.find((entry) => entry.id === user.user.id)!, { role: "partner" })
    database.account.push({ id: "google-account", accountId: "fixture-google-id", providerId: "google", userId: user.user.id, createdAt: new Date(), updatedAt: new Date() })
    database.session.splice(0)
    const response = await instance.handler(request("/sign-in/social", {
      provider: "google", idToken: { token: googleToken(email) },
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).user.id).toBe(user.user.id)
    expect(database.user).toHaveLength(2)
  })

  it.each([false, true])("vérifie un magic link existant sans inscription implicite (compte présent=%s)", async (existing) => {
    const { database, instance } = await fixture()
    const token = "fixture-existing-token"
    database.verification.push({
      id: "fixture-verification", identifier: token,
      value: JSON.stringify({ email: existing ? ADMIN_EMAIL : "removed@example.test", attempt: 0 }),
      expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date(),
    })
    const response = await instance.handler(request(`/magic-link/verify?token=${token}&callbackURL=/admin`))
    expect(response.status).toBe(302)
    if (existing) {
      expect(response.headers.get("location")).toBe(`${BASE_URL}/admin`)
      expect(database.session).toHaveLength(1)
    } else {
      expect(response.headers.get("location")).toContain("new_user_signup_disabled")
      expect(database.session).toHaveLength(0)
      expect(response.headers.getSetCookie()).toHaveLength(0)
    }
    expect(database.user).toHaveLength(1)
  })

  it("conserve login, session et déconnexion d'un administrateur préexistant avec les hooks réels", async () => {
    const { database, instance } = await fixture()
    const login = await instance.handler(request("/sign-in/email", { email: ADMIN_EMAIL, password: PASSWORD }))
    expect(login.status).toBe(200)
    expect((await login.clone().json()).user.role).toBe("admin")
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failedLoginAttempts: 0, lastLoginAt: expect.any(Date) }),
    }))
    const cookie = cookies(login)
    const session = await instance.handler(request("/get-session", undefined, cookie))
    expect((await session.json()).user.email).toBe(ADMIN_EMAIL)
    const logout = await instance.handler(request("/sign-out", {}, cookie))
    expect(logout.status).toBe(200)
    expect(database.session).toHaveLength(0)
    expect(database.user).toHaveLength(1)
  })

  it("conserve la récupération du mot de passe admin", async () => {
    const { database, instance } = await fixture()
    const response = await instance.handler(request("/request-password-reset", { email: ADMIN_EMAIL, redirectTo: "/reinitialiser-mot-de-passe" }))
    expect(response.status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
    expect(database.verification).toHaveLength(1)
    expect(database.user).toHaveLength(1)
  })

  it.each([
    ["/api/inscription/partenaire", registerPartner],
    ["/api/formations/organismes", registerOrganization],
  ] as const)("refuse %s avant lecture du corps, DB et email", async (path, register) => {
    const req = new NextRequest(`${BASE_URL}${path}`, { method: "POST", body: "invalid-json" })
    const readBody = vi.spyOn(req, "json")
    const response = await (register as (req: NextRequest) => Promise<Response>)(req)
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "public_registration_closed" })
    expect(response.headers.get("content-type")).toContain("charset=utf-8")
    expect(readBody).not.toHaveBeenCalled()
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
