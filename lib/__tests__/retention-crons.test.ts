import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { parseRepairOptions } from "../../scripts/verify-data-retention"

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn(),
  bundleDelete: vi.fn(),
  bookingDelete: vi.fn(),
  bookingUpdate: vi.fn(),
  draftDelete: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: {
  $executeRaw: mocks.executeRaw,
  bundleRun: { deleteMany: mocks.bundleDelete },
  booking: { deleteMany: mocks.bookingDelete, updateMany: mocks.bookingUpdate },
  pdfFormDraft: { deleteMany: mocks.draftDelete },
} }))

import * as bundleCron from "../../app/api/cron/bundle-runs-purge/route"
import * as bookingCron from "../../app/api/cron/booking-purge/route"
import * as draftCron from "../../app/api/admin/pdf/cron/purge-drafts/route"

const request = (headers: Record<string, string> = {}) =>
  new NextRequest("https://example.invalid/api/cron/retention", { headers })

describe("retention cron authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv("CRON_SECRET", "test-retention-secret")
    vi.stubEnv("CRON_PURGE_SECRET", "")
  })
  afterEach(() => vi.unstubAllEnvs())

  for (const [name, cron] of [["bundles", bundleCron], ["bookings", bookingCron], ["pdf", draftCron]] as const) {
    it(`${name}: refuses missing/mismatched credentials before any write`, async () => {
      const attempts: Record<string, string>[] = [{}, { authorization: "Bearer incorrect" }, { "x-cron-secret": "incorrect" }]
      for (const headers of attempts) {
        const response = await cron.GET(request(headers))
        expect(response.status).toBe(403)
        expect(response.headers.get("content-type")).toContain("charset=utf-8")
      }
      for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled()
    })
    it(`${name}: fails closed if its secret is absent`, async () => {
      vi.stubEnv("CRON_SECRET", "")
      expect((await cron.POST(request())).status).toBe(500)
      for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled()
    })
  }

  it("retains compatibility with the PDF purge's dedicated secret", async () => {
    vi.stubEnv("CRON_SECRET", "")
    vi.stubEnv("CRON_PURGE_SECRET", "legacy-test-secret")
    mocks.draftDelete.mockResolvedValue({ count: 2 })
    const response = await draftCron.GET(request({ "x-cron-secret": "legacy-test-secret" }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ purgedDrafts: 2 })
  })

  it("minimizes old bookings even when their name was already removed", async () => {
    mocks.bookingDelete.mockResolvedValue({ count: 0 })
    mocks.bookingUpdate.mockResolvedValue({ count: 1 })
    const response = await bookingCron.POST(request({ authorization: "Bearer test-retention-secret" }))
    expect(await response.json()).toEqual({ ok: true, deleted: 0, anonymized: 1 })
    const { where, data } = mocks.bookingUpdate.mock.calls[0][0]
    expect(where.OR).toEqual(expect.arrayContaining([
      { citizenEmail: { not: null } }, { userId: { not: null } },
      { internalNote: { not: null } }, { cancelReason: { not: null } },
      { rejectionReason: { not: null } }, { formData: { not: {} } },
    ]))
    expect(data).toMatchObject({ userId: null, internalNote: null, cancelReason: null, rejectionReason: null, formData: {} })
    expect(where.date.lt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("historical repair operator safeguards", () => {
  it("defaults to bounded read-only mode", () => {
    expect(parseRepairOptions([])).toEqual({ apply: false, maxRows: 500, reviewToken: undefined })
  })
  it("requires a reviewed token for apply", () => {
    expect(() => parseRepairOptions(["--apply"])).toThrow(/review-token/)
    expect(parseRepairOptions(["--apply", `--review-token=${"a".repeat(64)}`, "--max-rows=10"]).apply).toBe(true)
  })
  it("rejects conflicting modes, unknown flags and duplicate arguments", () => {
    for (const args of [["--dry-run", "--apply"], ["--force"], ["--max-rows=1", "--max-rows=5"]]) {
      expect(() => parseRepairOptions(args)).toThrow()
    }
  })
  it("caps the number of reviewed candidates", () => {
    for (const limit of [0, 5001]) expect(() => parseRepairOptions([`--max-rows=${limit}`])).toThrow(/1\.\.5000/)
  })
})
