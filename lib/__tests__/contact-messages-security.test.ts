import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ readonly: vi.fn(), rate: vi.fn(), send: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/admin/readonly-guard", () => ({ ensureWriteAllowed: mocks.readonly }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit: mocks.rate, getClientIp: () => "192.0.2.1" }));
vi.mock("@/lib/activity-logger", () => ({ logActivity: mocks.log }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.send }; } }));
import { POST } from "@/app/api/contact-messages/route";

const valid = {
  name: "  Élodie Dupont  ",
  email: "  ELODIE@EXAMPLE.TEST  ",
  subject: "  Une question  ",
  message: "  Bonjour,\r\nVoici ma question.\nMerci !  ",
};

function request(body: unknown = valid) {
  return new NextRequest("https://example.test/api/contact-messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("contact form email header boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "fixture-key");
    vi.stubEnv("EMAIL_FROM", "noreply@example.test");
    vi.stubEnv("CONTACT_EMAIL_FROM", "contact@example.test");
    mocks.readonly.mockResolvedValue(null);
    mocks.rate.mockResolvedValue({ ok: true, resetAt: Date.now() + 60_000 });
    mocks.send.mockResolvedValue({ data: { id: "fixture-email" }, error: null });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it.each([
    ["name", "Élodie\r\nBcc: attacker@example.test"],
    ["name", "Élodie\rBcc: attacker@example.test"],
    ["name", "Élodie\nBcc: attacker@example.test"],
    ["name", "\nÉlodie Dupont"],
    ["email", "elodie@example.test\r\nBcc: attacker@example.test"],
    ["email", "elodie@example.test\n"],
    ["email", "\relodie@example.test"],
    ["subject", "Question\r\nBcc: attacker@example.test"],
    ["subject", "Question\r"],
    ["subject", "\nQuestion"],
  ])("rejects CR/LF in raw %s before any email or activity write (%j)", async (field, value) => {
    const response = await POST(request({ ...valid, [field]: value }));
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("accepts an accented name, spaces and a multiline message", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Élodie Dupont (formulaire) <noreply@example.test>",
      to: "contact@example.test",
      replyTo: "elodie@example.test",
      subject: "[Formulaire] Une question",
      text: expect.stringContaining("Bonjour,\r\nVoici ma question.\nMerci !"),
    }));
    expect(mocks.log).toHaveBeenCalledOnce();
  });

  it.each([null, [], 4, {}, { ...valid, name: 123 }, { ...valid, subject: " " }, { ...valid, email: "invalid" }, { ...valid, message: "x" }, { ...valid, message: "x".repeat(5001) }])(
    "rejects an invalid payload without contacting the provider (%j)", async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.log).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed JSON as a client error", async () => {
    const response = await POST(new NextRequest("https://example.test/api/contact-messages", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("returns the existing read-only refusal before rate limiting or sending", async () => {
    mocks.readonly.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("returns a bounded retry delay when the shared limiter refuses", async () => {
    mocks.rate.mockResolvedValue({ ok: false, resetAt: Date.now() + 30_000 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("x-ratelimit-limit")).toBe("3");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(30);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("keeps provider failure private and avoids a successful activity entry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockResolvedValue({ data: null, error: { message: "private-provider-diagnostic" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private-provider-diagnostic");
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
