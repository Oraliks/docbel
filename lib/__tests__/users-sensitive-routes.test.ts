import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminAuth: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  deleteUserAndPersonalData: vi.fn(),
  hash: vi.fn(),
  tx: {
    user: { update: vi.fn() },
    account: { upsert: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}))

vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.requireAdminAuth }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/users-delete", () => ({ deleteUserAndPersonalData: mocks.deleteUserAndPersonalData }))
vi.mock("bcryptjs", () => ({ hash: mocks.hash }))

import { DELETE, PUT } from "@/app/api/users/[id]/route"

const target = { params: Promise.resolve({ id: "user-1" }) }
const existingUser = {
  id: "user-1", name: "Exemple", email: "owner@example.test",
  role: "admin", status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}
const put = (body: Record<string, unknown>) => PUT(new NextRequest("https://docbel.test/api/users/user-1", {
  method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
}), target)
const remove = () => DELETE(new NextRequest("https://docbel.test/api/users/user-1", { method: "DELETE" }), target)

describe("modifications sensibles administratives", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.requireAdminAuth.mockResolvedValue({ isAuthorized: true, user: { id: "admin-2" } })
    mocks.findUnique.mockResolvedValue(existingUser)
    mocks.findFirst.mockResolvedValue(null)
    mocks.hash.mockResolvedValue("test-password-hash")
    mocks.tx.user.update.mockResolvedValue(existingUser)
    mocks.transaction.mockImplementation(async (operation) => operation(mocks.tx))
  })

  it.each([
    { role: "user" }, { role: "partner" }, { role: "employer" },
    { status: "disabled" }, { status: "locked" }, { status: "pending" },
    { password: "ValidTest123!" },
  ])("révoque sessions propres et impersonées pour %j", async (body) => {
    const response = await put(body)
    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.tx.session.deleteMany).toHaveBeenCalledExactlyOnceWith({
      where: { OR: [{ userId: "user-1" }, { impersonatedBy: "user-1" }] },
    })
  })

  it("révoque aussi lors d'une promotion (aucun rôle en session ne reste périmé)", async () => {
    mocks.findUnique.mockResolvedValue({ ...existingUser, role: "user" })
    expect((await put({ role: "admin" })).status).toBe(200)
    expect(mocks.tx.session.deleteMany).toHaveBeenCalledOnce()
  })

  it.each([{ name: "Nouveau nom" }, { role: "admin" }, { status: "active" }])(
    "conserve les sessions pour une édition sans révocation nécessaire %j", async (body) => {
      expect((await put(body)).status).toBe(200)
      expect(mocks.tx.session.deleteMany).not.toHaveBeenCalled()
    },
  )

  it("modifie le credential et révoque dans la même transaction", async () => {
    expect((await put({ password: "ValidTest123!" })).status).toBe(200)
    expect(mocks.tx.account.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: { password: "test-password-hash" },
    }))
    expect(mocks.tx.account.upsert.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.tx.session.deleteMany.mock.invocationCallOrder[0])
  })

  it("ne confirme pas l'édition si la révocation échoue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.tx.session.deleteMany.mockRejectedValue(new Error("Simulated revocation failure"))
    expect((await put({ status: "disabled" })).status).toBe(500)
    log.mockRestore()
  })

  it("supprime via l'opération transverse après autorisation admin", async () => {
    const response = await remove()
    expect(response.status).toBe(200)
    expect(mocks.deleteUserAndPersonalData).toHaveBeenCalledExactlyOnceWith("user-1")
  })

  it("refuse de supprimer son propre compte", async () => {
    mocks.requireAdminAuth.mockResolvedValue({ isAuthorized: true, user: { id: "user-1" } })
    expect((await remove()).status).toBe(400)
    expect(mocks.deleteUserAndPersonalData).not.toHaveBeenCalled()
  })

  it("refuse une suppression sans autorisation avant toute lecture DB", async () => {
    mocks.requireAdminAuth.mockResolvedValue({ isAuthorized: false, error: new Response(null, { status: 403 }) })
    expect((await remove()).status).toBe(403)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.deleteUserAndPersonalData).not.toHaveBeenCalled()
  })

  it("ne confirme pas une suppression dont la transaction échoue", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.deleteUserAndPersonalData.mockRejectedValue(new Error("Simulated transaction rollback"))
    expect((await remove()).status).toBe(500)
    log.mockRestore()
  })
})
