import { describe, expect, it } from "vitest"
import { UserStatus } from "@prisma/client"
import { requireAdminAuth, withAdminAuthTestOverride } from "@/lib/auth-check"
import { saveBlob, withBlobStorageTestAdapter } from "@/lib/storage/blob-storage"

const admin = {
  isAuthorized: true as const,
  user: { id: "recipe-admin", name: "Recipe Admin", email: "recipe@example.test", role: "admin", status: UserStatus.active },
}

describe("coutures de recette Barèmes", () => {
  it("isole deux identités simulées concurrentes et rétablit le guard normal", async () => {
    const [first, second] = await Promise.all([
      withAdminAuthTestOverride(async () => admin, async () => {
        await Promise.resolve()
        return (await requireAdminAuth()).user?.id
      }),
      withAdminAuthTestOverride(async () => ({ ...admin, user: { ...admin.user, id: "recipe-admin-2" } }), async () => {
        await Promise.resolve()
        return (await requireAdminAuth()).user?.id
      }),
    ])

    expect(first).toBe("recipe-admin")
    expect(second).toBe("recipe-admin-2")
    await expect(requireAdminAuth()).rejects.toThrow("outside a request scope")
  })

  it("refuse les coutures hors de NODE_ENV=test", async () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = "production"
    try {
      await expect(withAdminAuthTestOverride(async () => admin, async () => undefined)).rejects.toThrow("only available")
      await expect(withBlobStorageTestAdapter({ save: async () => "blobs:https://fixture.private.blob.vercel-storage.com/x", get: async () => null, delete: async () => undefined }, async () => undefined)).rejects.toThrow("only available")
    } finally {
      process.env.NODE_ENV = previous
    }
  })

  it("isole les stores parallèles et ne conserve pas l'adaptateur après une exception", async () => {
    const makeStore = (name: string) => ({
      save: async () => `blobs:https://fixture.private.blob.vercel-storage.com/${name}`,
      get: async () => null,
      delete: async () => undefined,
    })
    const [first, second] = await Promise.all([
      withBlobStorageTestAdapter(makeStore("first"), () => saveBlob(Buffer.from("a"), "x", true)),
      withBlobStorageTestAdapter(makeStore("second"), () => saveBlob(Buffer.from("b"), "x", true)),
    ])

    expect(first).toContain("/first")
    expect(second).toContain("/second")
    await expect(withBlobStorageTestAdapter(makeStore("failing"), async () => { throw new Error("fixture failure") })).rejects.toThrow("fixture failure")
    await expect(saveBlob(Buffer.from("normal"), "x", true)).rejects.toThrow("Missing private Blob store configuration")
  })
})
