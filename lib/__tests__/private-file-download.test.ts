import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/files/[id]/download/route"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
  findFile: vi.fn(),
  getBlob: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUser }, file: { findUnique: mocks.findFile } },
  withDbRetry: <T>(fn: () => Promise<T>) => fn(),
}))
vi.mock("@/lib/storage/blob-storage", () => ({
  isBlobsPath: (path: string) => path.startsWith("https://"),
  isPrivateBlobPath: (path: string) => path.includes(".private.blob."),
  getBlob: mocks.getBlob,
}))

const admin = { id: "admin-1", name: "Admin fixture", email: "admin@example.test", role: "admin", status: "active" }
const privateFile = {
  id: "file-1", name: "fixture.pdf", isPrivate: true,
  filePath: "https://fixture.private.blob.vercel-storage.com/private/fixture.pdf",
  mimeType: "application/pdf",
}

function download() {
  return GET(new NextRequest("https://docbel.example.test/api/files/file-1/download"), {
    params: Promise.resolve({ id: "file-1" }),
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.findFile.mockResolvedValue(privateFile)
  // Le cookie conserve volontairement admin/active dans tous les cas.
  mocks.getSession.mockResolvedValue({ user: admin })
  mocks.findUser.mockResolvedValue(admin)
  mocks.getBlob.mockResolvedValue(Buffer.from("%PDF-fixture"))
})

describe("téléchargement privé — autorisation relue en DB", () => {
  it("sert un fichier privé à un admin encore actif sans cache public", async () => {
    const response = await download()
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.text()).toBe("%PDF-fixture")
    expect(mocks.findUser).toHaveBeenCalledWith({
      where: { id: admin.id },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
  })

  it.each(["disabled", "pending", "locked"])("refuse immédiatement un admin %s malgré son cookie", async (status) => {
    mocks.findUser.mockResolvedValue({ ...admin, status })
    const response = await download()
    expect(response.status).toBe(401)
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })

  it("refuse un admin rétrogradé malgré son rôle de session", async () => {
    mocks.findUser.mockResolvedValue({ ...admin, role: "user" })
    expect((await download()).status).toBe(403)
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })

  it("refuse un compte supprimé", async () => {
    mocks.findUser.mockResolvedValue(null)
    expect((await download()).status).toBe(401)
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })

  it("refuse une requête anonyme avant la lecture du stockage", async () => {
    mocks.getSession.mockResolvedValue(null)
    expect((await download()).status).toBe(401)
    expect(mocks.getBlob).not.toHaveBeenCalled()
    expect(mocks.findUser).not.toHaveBeenCalled()
  })

  it("protège un store privé même si le flag DB est incohérent", async () => {
    mocks.findFile.mockResolvedValue({ ...privateFile, isPrivate: false })
    mocks.getSession.mockResolvedValue(null)
    expect((await download()).status).toBe(401)
    expect(mocks.getBlob).not.toHaveBeenCalled()
  })

  it("laisse les fichiers publics accessibles sans session", async () => {
    mocks.findFile.mockResolvedValue({
      ...privateFile, isPrivate: false,
      filePath: "https://fixture.public.blob.vercel-storage.com/public/fixture.pdf",
    })
    mocks.getSession.mockResolvedValue(null)
    const response = await download()
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600")
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.findUser).not.toHaveBeenCalled()
  })
})
