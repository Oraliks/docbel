import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ setting: vi.fn(), sources: vi.fn(), ingest: vi.fn(), scan: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { ingestionSource: { findMany: mocks.sources } } }))
vi.mock("@/lib/app-settings", () => ({ getSetting: mocks.setting, SETTING_KEYS: { CHOMAGE_IA_INGESTION_ENABLED: "enabled" } }))
vi.mock("@/lib/chomage-ia/ingestion", () => ({ runIngestionCheck: mocks.ingest }))
vi.mock("@/lib/chomage-ia/obsolescence", () => ({ runObsolescenceScan: mocks.scan }))
import * as ingestion from "../../app/api/chomage-ia/ingestion/cron/route"
import * as obsolescence from "../../app/api/chomage-ia/sources/cron-obsolescence/route"

describe("knowledge cron authentication", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CRON_SECRET", "test-knowledge-secret") })
  afterEach(() => vi.unstubAllEnvs())
  for (const [name, route] of [["ingestion", ingestion], ["obsolescence", obsolescence]] as const) {
    it(`${name}: refuses forged Vercel user-agent when no secret is configured`, async () => {
      vi.stubEnv("CRON_SECRET", "")
      const res = await route.GET(new NextRequest("https://example.invalid/cron", { headers: { "user-agent": "vercel-cron/1.0" } }))
      expect(res.status).toBe(500)
      for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled()
    })
    it(`${name}: refuses secrets passed in URLs`, async () => {
      const res = await route.GET(new NextRequest("https://example.invalid/cron?secret=test-knowledge-secret"))
      expect(res.status).toBe(403)
      for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled()
    })
    it(`${name}: accepts an authenticated request`, async () => {
      mocks.setting.mockResolvedValue("false")
      mocks.scan.mockResolvedValue({ scanned: 0 })
      const res = await route.POST(new NextRequest("https://example.invalid/cron", { headers: { authorization: "Bearer test-knowledge-secret" } }))
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("charset=utf-8")
    })
  }
  it("ingestion processes subsequent bounded pages without skipping the domain filter", async () => {
    mocks.setting.mockResolvedValue("true")
    mocks.sources.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ id: `source-${i}`, name: "Synthetic" })))
      .mockResolvedValueOnce([{ id: "source-final", name: "Synthetic" }])
    mocks.ingest.mockResolvedValue({ created: 0, skipped: 0, detected: 0, error: null })
    const res = await ingestion.GET(new NextRequest("https://example.invalid/cron?domain=example.invalid", { headers: { "x-cron-secret": "test-knowledge-secret" } }))
    expect((await res.json()).scanned).toBe(101)
    expect(mocks.sources).toHaveBeenNthCalledWith(2, {
      where: { enabled: true, domain: "example.invalid" }, take: 100, orderBy: { id: "asc" }, cursor: { id: "source-99" }, skip: 1,
    })
    expect(mocks.ingest).toHaveBeenCalledTimes(101)
  })
})
