import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getSetting: vi.fn(),
  checkRateLimit: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { documentBundle: { findMany: mocks.findMany } } }));
vi.mock("@/lib/app-settings", () => ({
  getSetting: mocks.getSetting,
  SETTING_KEYS: { AI_HELP_ENABLED: "ai_help_enabled" },
}));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => "127.0.0.1",
}));

import { POST } from "@/app/api/intent-detect/route";

function request(body: Record<string, unknown>) {
  return new NextRequest("https://example.test/api/intent-detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "emploi", ...body }),
  });
}

describe("intent detection privacy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.findMany.mockResolvedValue([{
      id: "employment", slug: "emploi", name: "Emploi", description: null,
      vocabularyTags: ["emploi"], items: [],
    }]);
    mocks.getSetting.mockResolvedValue("true");
    mocks.checkRateLimit.mockReturnValue({ ok: true, remaining: 19, resetAt: Date.now() + 60_000 });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      content: [{ text: JSON.stringify({ topSlug: "emploi", explanation: "Consultez ce parcours." }) }],
    })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([{}, { allowAi: false }])("keeps the search local without explicit opt-in: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toMatchObject({ aiUsed: false, suggestions: [{ slug: "emploi" }] });
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.getSetting).not.toHaveBeenCalled();
  });

  it("sends the query only with explicit opt-in and the configured AI feature", async () => {
    const response = await POST(request({ allowAi: true }));
    expect(await response.json()).toMatchObject({ aiUsed: true, suggestions: [{ slug: "emploi" }] });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it.each(["false", ""])('preserves local results when the global AI setting is "%s"', async (value) => {
    mocks.getSetting.mockResolvedValue(value);
    expect(await (await POST(request({ allowAi: true }))).json()).toMatchObject({ aiUsed: false });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("preserves local results when no provider key exists", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await (await POST(request({ allowAi: true }))).json()).toMatchObject({ aiUsed: false });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects truthy strings instead of treating them as consent", async () => {
    expect((await POST(request({ allowAi: "true" }))).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("falls back locally without logging a provider response that could contain the query", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetch.mockResolvedValue(new Response("sensitive query echoed by provider", { status: 500 }));
    expect(await (await POST(request({ allowAi: true }))).json()).toMatchObject({ aiUsed: false });
    expect(log).toHaveBeenCalledWith("Anthropic API error:", 500);
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive query");
  });

  it("rate limits before accessing the catalogue or the external provider", async () => {
    mocks.checkRateLimit.mockReturnValue({ ok: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const response = await POST(request({ allowAi: true }));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
