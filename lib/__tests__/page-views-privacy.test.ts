import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CONSENT_COOKIE, makeAcceptAll, makeRejectAll, serializeConsent } from "@/lib/cookie-consent/consent";

const mocks = vi.hoisted(() => ({ create: vi.fn(), checkRateLimit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { pageView: { create: mocks.create } } }));
vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => "127.0.0.1",
}));
import { POST } from "@/app/api/page-views/route";

function request(cookie?: string, referrer?: string) {
  return new NextRequest("https://example.test/api/page-views", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie === undefined ? {} : { cookie: `${CONSENT_COOKIE}=${cookie}` }),
    },
    body: JSON.stringify({ slug: "actualites", device: "desktop", referrer }),
  });
}

describe("page views privacy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.create.mockResolvedValue({ id: "event" });
    mocks.checkRateLimit.mockReturnValue({ ok: true, remaining: 59, resetAt: Date.now() + 60_000 });
  });

  it.each([
    undefined,
    "malformed",
    serializeConsent(makeRejectAll(new Date().toISOString())),
    encodeURIComponent(JSON.stringify({ v: 0, analytics: true })),
  ])("does not record without a current analytics consent (%s)", async (cookie) => {
    const response = await POST(request(cookie));
    expect(await response.json()).toEqual({ ok: false, skipped: true });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it("removes credentials, path, query and fragment from the referrer", async () => {
    const response = await POST(request(
      serializeConsent(makeAcceptAll(new Date().toISOString())),
      "https://someone:password@source.example/private/person?email=person@example.test&token=secret#name",
    ));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ data: {
      slug: "actualites", device: "desktop", referrer: "https://source.example",
    } });
  });

  it.each(["not a URL", "javascript:alert(1)", "data:text/plain,private", "file:///private"]) (
    "discards an invalid or unsupported referrer (%s)", async (referrer) => {
      await POST(request(serializeConsent(makeAcceptAll(new Date().toISOString())), referrer));
      expect(mocks.create).toHaveBeenCalledWith({ data: {
        slug: "actualites", device: "desktop", referrer: undefined,
      } });
    },
  );

  it("preserves the request limit for consented visits", async () => {
    mocks.checkRateLimit.mockReturnValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const response = await POST(request(serializeConsent(makeAcceptAll(new Date().toISOString()))));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
