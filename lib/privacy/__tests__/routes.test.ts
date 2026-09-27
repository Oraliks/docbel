import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  writeGuard: vi.fn(),
  inventory: vi.fn(),
  preview: vi.fn(),
  exportDataset: vi.fn(),
}))

vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.auth }))
vi.mock("@/lib/admin/readonly-guard", () => ({ ensureWriteAllowed: mocks.writeGuard }))
vi.mock("@/lib/privacy/inventory", () => ({
  buildPrivacyInventory: mocks.inventory,
  buildDeletionPreview: mocks.preview,
}))
vi.mock("@/lib/privacy/export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../export")>()),
  exportPrivacyDataset: mocks.exportDataset,
}))
vi.mock("@/lib/privacy/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  enforcePrivacyRateLimit: mocks.rateLimit,
}))

import { GET as getInventory } from "@/app/api/admin/privacy/accounts/[userId]/inventory/route"
import { GET as getExport } from "@/app/api/admin/privacy/accounts/[userId]/export/route"
import { POST as postPreview } from "@/app/api/admin/privacy/accounts/[userId]/deletion-preview/route"
import { POST as postDelete } from "@/app/api/admin/privacy/accounts/[userId]/delete/route"

const HASH = "a".repeat(64)
const OTHER_HASH = "b".repeat(64)
const inventory = {
  version: 1,
  subject: {
    id: "user-1",
    email: "subject@example.test",
    name: "Subject",
    role: "user",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  entries: [],
  unresolvedScopes: [],
  inventoryHash: HASH,
  policy: { executionEnabled: false, reason: "retention_matrix_unapproved" },
} as const

const context = { params: Promise.resolve({ userId: "user-1" }) }

describe("admin privacy routes", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockResolvedValue({
      isAuthorized: true,
      user: { id: "admin-1", name: "Admin", email: "admin@example.test", role: "admin", status: "active" },
    })
    mocks.rateLimit.mockResolvedValue(null)
    mocks.writeGuard.mockResolvedValue(null)
    mocks.inventory.mockResolvedValue(inventory)
    mocks.preview.mockReturnValue({ inventory, execution: { allowed: false } })
    mocks.exportDataset.mockResolvedValue({ dataset: "sessions", records: [], nextCursor: null, limit: 50 })
  })

  it("authentifie avant toute lecture privée", async () => {
    mocks.auth.mockResolvedValue({
      isAuthorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    })
    const response = await getInventory(new Request("https://docbel.test/api"), context)
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("content-type")).toContain("charset=utf-8")
    expect(mocks.rateLimit).not.toHaveBeenCalled()
    expect(mocks.inventory).not.toHaveBeenCalled()
  })

  it("sert l'inventaire privé en UTF-8 et no-store", async () => {
    const response = await getInventory(new Request("https://docbel.test/api"), context)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(response.headers.get("content-type")).toContain("charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(mocks.inventory).toHaveBeenCalledWith("user-1")
  })

  it("isole l'export sur l'ID sujet et transmet une page bornée", async () => {
    const response = await getExport(
      new Request("https://docbel.test/api?dataset=sessions&limit=25"),
      context,
    )
    expect(response.status).toBe(200)
    expect(mocks.exportDataset).toHaveBeenCalledWith({
      userId: "user-1",
      dataset: "sessions",
      cursor: undefined,
      limit: 25,
    })
    expect(response.headers.get("content-disposition")).toContain("docbel-privacy-user-1-sessions.json")
  })

  it("refuse une page au-delà de la borne", async () => {
    const response = await getExport(
      new Request("https://docbel.test/api?dataset=sessions&limit=101"),
      context,
    )
    expect(response.status).toBe(400)
    expect(mocks.exportDataset).not.toHaveBeenCalled()
  })

  it("refuse un aperçu fondé sur un inventaire périmé", async () => {
    const response = await postPreview(
      new Request("https://docbel.test/api", {
        method: "POST",
        body: JSON.stringify({ expectedInventoryHash: OTHER_HASH }),
      }),
      context,
    )
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "privacy_inventory_changed" })
  })

  it("applique le garde lecture seule avant une confirmation d'effacement", async () => {
    mocks.writeGuard.mockResolvedValue(NextResponse.json({ code: "demo_read_only" }, { status: 403 }))
    const response = await postDelete(
      new Request("https://docbel.test/api", {
        method: "POST",
        body: JSON.stringify({ confirmUserId: "user-1", inventoryHash: HASH }),
      }),
      context,
    )
    expect(response.status).toBe(403)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("content-type")).toContain("charset=utf-8")
    expect(mocks.inventory).not.toHaveBeenCalled()
  })

  it("refuse la confirmation si l'inventaire a changé", async () => {
    const response = await postDelete(
      new Request("https://docbel.test/api", {
        method: "POST",
        body: JSON.stringify({ confirmUserId: "user-1", inventoryHash: OTHER_HASH }),
      }),
      context,
    )
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "privacy_inventory_changed" })
  })

  it("n'active aucun effacement même avec une empreinte courante", async () => {
    const response = await postDelete(
      new Request("https://docbel.test/api", {
        method: "POST",
        body: JSON.stringify({ confirmUserId: "user-1", inventoryHash: HASH }),
      }),
      context,
    )
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: "retention_matrix_unapproved" })
  })
})
