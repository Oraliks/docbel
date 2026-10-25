import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { proxy, config } from "@/proxy";
import { useDraftAutosave } from "@/components/pdf-forms/use-draft-autosave";
import { GET as readRun } from "@/app/api/documents/bundles/[id]/run/route";
import { POST as resume } from "@/app/api/bundles/resume/route";

const io = vi.hoisted(() => ({
  session: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn(),
  findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: io.session } } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: io.cookieGet, set: io.cookieSet }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { bundleRun: {
  findFirst: io.findFirst, findUnique: io.findUnique, create: io.create, update: io.update,
} } }));
vi.mock("@/lib/admin/readonly-guard", () => ({ ensureWriteAllowed: async () => null }));
vi.mock("@/lib/bundles/analytics", () => ({ trackBundleEvent: async () => {} }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true }), getClientIp: () => "127.0.0.1",
}));

const COOKIE = "beldoc-bundle-session";
function req(path: string, method = "POST", body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method, headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function existing(sessionId: string | null = "existing-session", userId: string | null = null) {
  return { id: "run", bundleId: "bundle", sessionId, userId, status: "in_progress",
    completedAt: null, anonymizedAt: null, resumeCodeExpiresAt: new Date(Date.now() + 60_000),
    bundle: { id: "bundle", slug: "existing", name: "Synthetic fixture", active: true } };
}
beforeEach(() => {
  vi.resetAllMocks();
  io.session.mockResolvedValue(null);
  io.findUnique.mockResolvedValue(existing());
  io.findFirst.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllGlobals());

describe("V1 — frontière HTTP des écritures de dossiers", () => {
  it.each([
    ["/api/user/profile", "PUT"],
    ["/api/user/profile", "DELETE"],
    ["/api/user/%70rofile/", "PUT"],
    ["/api/booking/fixture/book", "POST"],
    ["/api/booking/fixture/waitlist", "POST"],
    ["/api/booking/a%2Fb/book/", "POST"],
    ["/api/booking/fixture/%77aitlist", "POST"],
    ["/api/documents/bundles/fixture/run", "POST"],
    ["/api/documents/bundles/fixture/run", "PATCH"],
    ["/api/documents/bundles/a%2Fb/run", "POST"],
    ["/api/documents/bundles/a%252Fb/run/", "POST"],
    ["/api/documents/bundles/fixture/%72un?forceNew=true", "POST"],
    ["/api/pdf/fixture/draft", "PUT"],
    ["/api/pdf/fixture/draft/", "DELETE"],
    ["/api/pdf/a%2Fb/draft", "PUT"],
    ["/api/bundles/runs/fixture", "DELETE"],
    ["/api/bundles/runs/fixture/email-code", "POST"],
  ])("refuse %s %s avant lecture corps/DB/cookie", async (path, method) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
    const request = req(path, method, { payload: { fixture: true } }, {
      cookie: "better-auth.session_token=fixture-admin; beldoc-bundle-session=existing-session",
      "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy",
    });
    const readBody = vi.spyOn(request, "json");
    const response = await proxy(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "public_persistence_closed" });
    expect(response.headers.get("content-type")).toContain("charset=utf-8");
    expect(readBody).not.toHaveBeenCalled();
    expect(io.create).not.toHaveBeenCalled();
    expect(io.update).not.toHaveBeenCalled();
    expect(io.cookieSet).not.toHaveBeenCalled();
  });

  it.each([
    { delivery: "save" },
    { delivery: "download", bundleRunId: "existing-run" },
    { delivery: "doccle", bundleRunId: "existing-run" },
    { bundleRunId: "" },
  ])("refuse generate persistant %j sans consommer le corps du handler", async (body) => {
    const request = req("/api/pdf/fixture/generate", "POST", body);
    const response = await proxy(request);
    expect(response.status).toBe(403);
    expect(await request.json()).toEqual(body);
    expect(io.update).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/admin/pdf/forms/fixture/test-generate", "POST", { payload: {} }],
    ["/api/admin/pdf/dossiers", "POST", {}],
    ["/api/users", "POST", {}],
    ["/api/users/existing", "PATCH", {}],
    ["/api/user/profile", "GET", undefined],
    ["/api/booking/fixture/availability", "GET", undefined],
    ["/api/booking/fixture/dedupe-check", "POST", {}],
    ["/api/booking/fixture/resend-link", "POST", {}],
    ["/api/booking/manage/existing", "GET", undefined],
    ["/api/booking/manage/existing/cancel", "POST", {}],
    ["/api/booking/manage/existing/reschedule", "POST", {}],
    ["/api/booking/manage/existing/verify", "GET", undefined],
    ["/api/booking/manage/existing/confirm-presence", "POST", {}],
    ["/api/booking/manage/existing/ics", "GET", undefined],
    ["/api/booking/partner/tenants/existing/bookings/existing", "PATCH", {}],
    ["/api/cron/booking-waitlist", "POST", {}],
    ["/api/files/upload", "POST", undefined],
    ["/api/pdf/fixture/generate", "POST", { delivery: "download", payload: {} }],
    ["/api/pdf/fixture/draft", "GET", undefined],
    ["/api/documents/bundles/fixture/run", "GET", undefined],
    ["/api/bundles/resume", "POST", { code: "BELDOC-ABCD-EFGH" }],
    ["/api/bundles/runs/fixture/download-all", "GET", undefined],
    ["/api/baremes/thresholds", "GET", undefined],
  ] as const)("préserve le handler et ses gardes pour %s", async (path, method, body) => {
    const response = await proxy(req(path, method, body));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("laisse les pages publiques continuer hors staging", async () => {
    vi.stubEnv("APP_ENV", "development");
    expect(unstable_doesMiddlewareMatch({ config, url: "/outils/ma-situation-familiale" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/admin" })).toBe(true);
    const response = await proxy(req("/outils/ma-situation-familiale", "GET"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("lecture et reprise existantes sans mutation de dossier", () => {
  it("GET sans propriétaire renvoie null sans créer cookie ou interroger un dossier", async () => {
    const response = await readRun(req("/api/documents/bundles/bundle/run", "GET"), { params: Promise.resolve({ id: "bundle" }) });
    expect(await response.json()).toBeNull();
    expect(io.findFirst).not.toHaveBeenCalled();
    expect(io.cookieSet).not.toHaveBeenCalled();
  });
  it.each(["cookie", "user"])("GET conserve la lecture par %s sans nouveau cookie", async (owner) => {
    if (owner === "cookie") io.cookieGet.mockReturnValue({ value: "existing-session" });
    else io.session.mockResolvedValue({ user: { id: "existing-owner" } });
    io.findFirst.mockResolvedValue(existing());
    const response = await readRun(req("/api/documents/bundles/bundle/run", "GET"), { params: Promise.resolve({ id: "bundle" }) });
    expect((await response.json()).id).toBe("run");
    expect(io.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining(
      owner === "cookie" ? { sessionId: "existing-session" } : { userId: "existing-owner" },
    ) }));
    expect(io.cookieSet).not.toHaveBeenCalled();
    expect(io.update).not.toHaveBeenCalled();
  });
  it("reprend un code existant avec cookie de lecture, sans réécrire le run", async () => {
    const response = await resume(req("/api/bundles/resume", "POST", { code: "BELDOC-ABCD-EFGH" }));
    expect(response.status).toBe(200);
    expect(io.cookieSet).toHaveBeenCalledWith(COOKIE, "existing-session", expect.objectContaining({ httpOnly: true }));
    expect(io.update).not.toHaveBeenCalled();
  });
  it.each([false, true])("dossier sans sessionId : exige son propriétaire existant (présent=%s)", async (owner) => {
    io.findUnique.mockResolvedValue(existing(null, "existing-owner"));
    if (owner) io.session.mockResolvedValue({ user: { id: "existing-owner" } });
    const response = await resume(req("/api/bundles/resume", "POST", { code: "BELDOC-ABCD-EFGH" }));
    expect(response.status).toBe(owner ? 200 : 409);
    expect(io.update).not.toHaveBeenCalled();
    expect(io.create).not.toHaveBeenCalled();
    expect(io.cookieSet).not.toHaveBeenCalled();
  });
});

it("autosave n'envoie ni réponses ni suppression de brouillon et n'annonce aucune sauvegarde", () => {
  const fetch = vi.fn();
  const timer = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("setTimeout", timer);
  const draft = useDraftAutosave({ slug: "fixture", bundleRunId: "existing-run", values: { fixture: "ephemeral" } });
  draft.scheduleSave("step", "fixture");
  draft.flushDraft();
  draft.discardDraft();
  draft.resetSavedAt();
  expect(draft.lastSavedAt).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(timer).not.toHaveBeenCalled();
});
