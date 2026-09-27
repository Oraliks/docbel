import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), readonly: vi.fn(), setting: vi.fn(), rate: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.auth }));
vi.mock("@/lib/admin/readonly-guard", () => ({ ensureWriteAllowed: mocks.readonly }));
vi.mock("@/lib/app-settings", () => ({ getSetting: mocks.setting, SETTING_KEYS: { CHOMAGE_IA_VOICE_ENABLED: "voice" } }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit: mocks.rate, getClientIp: () => "127.0.0.1" }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
import { POST } from "@/app/api/chomage-ia/voice/transcribe/route";

function request() {
  const form = new FormData();
  form.append("audio", new Blob(["synthetic audio"], { type: "audio/wav" }), "test.wav");
  return new NextRequest("https://example.test/api/chomage-ia/voice/transcribe", { method: "POST", body: form });
}

describe("voice transcription boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "fixture-key-do-not-expose");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { id: "test-admin" } });
    mocks.readonly.mockResolvedValue(null);
    mocks.setting.mockResolvedValue("true");
    mocks.rate.mockResolvedValue({ ok: true, resetAt: Date.now() + 60_000 });
    mocks.fetch.mockResolvedValue(Response.json({ text: " test technique " }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([401, 403])("refuses unauthorized requests before provider access (%i)", async (status) => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: new Response(null, { status }) });
    expect((await POST(request())).status).toBe(status);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.setting).not.toHaveBeenCalled();
  });
  it("refuses read-only sessions before any external processing", async () => {
    mocks.readonly.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each(["disabled", "missing-key"])("requires voice configuration: %s", async (mode) => {
    if (mode === "disabled") mocks.setting.mockResolvedValue("false");
    else vi.stubEnv("OPENAI_API_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("returns retry headers for the shared limiter without calling OpenAI", async () => {
    mocks.rate.mockResolvedValue({ ok: false, resetAt: Date.now() + 20_000 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])("does not relay or log provider diagnostics (%i)", async (status) => {
    const log = vi.spyOn(console, "error");
    mocks.fetch.mockResolvedValue(Response.json({ error: { message: "fixture-key-do-not-expose private-audio-context" } }, { status }));
    const response = await POST(request());
    expect(response.status).toBe(status === 500 ? 502 : 503);
    const text = await response.text();
    expect(text).not.toMatch(/fixture-key|private-audio-context/);
    expect(text).toContain("voice_provider_");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(log).not.toHaveBeenCalled();
  });
  it.each(["TimeoutError", "AbortError", "TypeError"])("sanitizes network failure %s", async (name) => {
    const error = new Error("fixture-key-do-not-expose"); error.name = name;
    mocks.fetch.mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(name === "TypeError" ? 502 : 504);
    expect(await response.text()).not.toContain("fixture-key");
  });
  it.each([null, {}, { text: 123 }])("rejects malformed successful provider payload: %j", async (payload) => {
    mocks.fetch.mockResolvedValue(Response.json(payload));
    expect((await POST(request())).status).toBe(502);
  });
  it("returns only the transcript and retains the intended model and multipart format", async () => {
    const response = await POST(request());
    expect(await response.json()).toEqual({ text: "test technique" });
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(options.body.get("model")).toBe("whisper-1");
    expect(options.body.get("language")).toBe("fr");
    expect(options.body.get("file").name).toBe("audio.wav");
  });
});
