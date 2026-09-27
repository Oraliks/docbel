import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { apiError } from "@/lib/api/response"
import { POST as impersonate } from "@/app/api/admin/impersonate/route"
import { POST as stopImpersonating } from "@/app/api/admin/stop-impersonate/route"

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(), findUser: vi.fn(), createLog: vi.fn(), closeLog: vi.fn(),
  impersonateUser: vi.fn(), stopImpersonating: vi.fn(), getSession: vi.fn(), setCookie: vi.fn(),
}))

vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.requireAdminAuth }))
vi.mock("@/lib/auth", () => ({ auth: { api: {
  impersonateUser: mocks.impersonateUser,
  stopImpersonating: mocks.stopImpersonating,
  getSession: mocks.getSession,
} } }))
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: mocks.findUser },
  adminImpersonationLog: { create: mocks.createLog, updateMany: mocks.closeLog },
} }))
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "fixture-browser" }),
  cookies: async () => ({ set: mocks.setCookie }),
}))
vi.mock("@/lib/admin/demo-users", () => ({ isDemoEmail: () => false }))
vi.mock("@/lib/admin/readonly-guard", () => ({ READONLY_COOKIE: "docbel_readonly" }))

const admin = { id: "admin-1", role: "admin", status: "active" }
const target = { id: "user-1", role: "user", status: "active", email: "user@example.test" }
const reason = "Assistance demandée par le titulaire"

function request(body: Record<string, unknown> = { userId: target.id, reason }) {
  return new NextRequest("https://docbel.example.test/api/admin/impersonate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("NODE_ENV", "production")
  mocks.requireAdminAuth.mockResolvedValue({ isAuthorized: true, user: admin })
  mocks.findUser.mockResolvedValue(target)
  mocks.createLog.mockResolvedValue({ id: "log-1" })
  mocks.closeLog.mockResolvedValue({ count: 1 })
  mocks.impersonateUser.mockResolvedValue({})
  mocks.stopImpersonating.mockResolvedValue({})
})

afterEach(() => vi.unstubAllEnvs())

describe("impersonation DocBel — contrôle et audit obligatoires", () => {
  it.each([401, 403])("n'ouvre aucune session si le garde DB refuse (%s)", async (status) => {
    mocks.requireAdminAuth.mockResolvedValue({ isAuthorized: false, error: apiError(status, "Forbidden") })
    expect((await impersonate(request())).status).toBe(status)
    expect(mocks.findUser).not.toHaveBeenCalled()
    expect(mocks.impersonateUser).not.toHaveBeenCalled()
    expect(mocks.createLog).not.toHaveBeenCalled()
  })

  it.each([undefined, "court"])("exige une justification suffisante en production (%s)", async (reason) => {
    expect((await impersonate(request({ userId: target.id, reason }))).status).toBe(400)
    expect(mocks.impersonateUser).not.toHaveBeenCalled()
    expect(mocks.createLog).not.toHaveBeenCalled()
  })

  it("journalise la justification avant de créer la session et active la lecture seule", async () => {
    const response = await impersonate(request())
    expect(response.status).toBe(200)
    expect(mocks.createLog).toHaveBeenCalledWith({ data: {
      adminId: admin.id, targetId: target.id, reason,
      ipAddress: null, userAgent: "fixture-browser",
    } })
    expect(mocks.createLog.mock.invocationCallOrder[0]).toBeLessThan(mocks.impersonateUser.mock.invocationCallOrder[0])
    expect(mocks.setCookie).toHaveBeenCalledWith("docbel_readonly", "1", expect.objectContaining({ secure: true }))
  })

  it("ne crée aucune session quand le journal ne peut pas être écrit", async () => {
    mocks.createLog.mockRejectedValue(new Error("Audit database unavailable"))
    await expect(impersonate(request())).rejects.toThrow("Audit database unavailable")
    expect(mocks.impersonateUser).not.toHaveBeenCalled()
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it("conserve et clôture la tentative si Better Auth refuse la session", async () => {
    mocks.impersonateUser.mockRejectedValue(new Error("Session rejected"))
    await expect(impersonate(request())).rejects.toThrow("Session rejected")
    expect(mocks.closeLog).toHaveBeenCalledWith({
      where: { id: "log-1", stoppedAt: null }, data: { stoppedAt: expect.any(Date) },
    })
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it("permet de quitter l'impersonation depuis la session cible et ferme le journal", async () => {
    mocks.getSession.mockResolvedValue({ user: target, session: { impersonatedBy: admin.id } })
    expect((await stopImpersonating()).status).toBe(200)
    expect(mocks.requireAdminAuth).not.toHaveBeenCalled()
    expect(mocks.stopImpersonating).toHaveBeenCalledOnce()
    expect(mocks.closeLog).toHaveBeenCalledWith({
      where: { adminId: admin.id, targetId: target.id, stoppedAt: null },
      data: { stoppedAt: expect.any(Date) },
    })
  })

  it("garde l'arrêt idempotent hors impersonation", async () => {
    mocks.getSession.mockResolvedValue({ user: admin, session: {} })
    expect(await (await stopImpersonating()).json()).toEqual({ ok: true, alreadyStopped: true })
    expect(mocks.stopImpersonating).not.toHaveBeenCalled()
    expect(mocks.closeLog).not.toHaveBeenCalled()
  })
})
