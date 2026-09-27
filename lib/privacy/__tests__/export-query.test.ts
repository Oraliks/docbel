import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findSessions: vi.fn() }))

vi.mock("@/lib/prisma", () => ({
  prisma: { session: { findMany: mocks.findSessions } },
}))

import { exportPrivacyDataset } from "../export"

describe("privacy export query isolation", () => {
  beforeEach(() => vi.resetAllMocks())

  it("filtre par l'ID du sujet, borne take et produit un curseur", async () => {
    mocks.findSessions.mockResolvedValue([
      { id: "session-1", createdAt: new Date("2026-01-01") },
      { id: "session-2", createdAt: new Date("2026-01-02") },
      { id: "session-3", createdAt: new Date("2026-01-03") },
    ])

    const page = await exportPrivacyDataset({
      userId: "subject-1",
      dataset: "sessions",
      cursor: "previous-session",
      limit: 2,
    })

    expect(mocks.findSessions).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "subject-1" },
      cursor: { id: "previous-session" },
      skip: 1,
      take: 3,
    }))
    expect(page.records.map((row) => row.id)).toEqual(["session-1", "session-2"])
    expect(page.nextCursor).toBe("session-2")
  })

  it("bloque une clé secrète même si la couche DB en renvoie une par erreur", async () => {
    mocks.findSessions.mockResolvedValue([{ id: "session-1", token: "must-not-leak" }])
    await expect(exportPrivacyDataset({
      userId: "subject-1",
      dataset: "sessions",
      limit: 10,
    })).rejects.toThrow("Forbidden privacy export key: token")
  })
})
