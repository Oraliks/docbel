import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { proxy, config } from "@/proxy";
import { createDraftAutosaveActions } from "@/components/pdf-forms/use-draft-autosave";
import { GET as readRun } from "@/app/api/documents/bundles/[id]/run/route";
import { POST as resume } from "@/app/api/bundles/resume/route";
import { isStagingTestPersistenceEnabled } from "@/lib/public-access";

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
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

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
  it("restitue le brouillon de formulaire stocké dans le run au rechargement", async () => {
    io.cookieGet.mockReturnValue({ value: "fictional-session-id" });
    const savedDraft = { fictionalField: "saved synthetic answer" };
    io.findFirst.mockResolvedValue({
      ...existing(),
      draftPayloads: { "fictional-form": savedDraft },
      lastFormId: "fictional-form-id",
      lastStepId: "fictional-step",
      lastActiveField: "fictionalField",
    });
    const response = await readRun(req("/api/documents/bundles/bundle/run", "GET"), { params: Promise.resolve({ id: "bundle" }) });
    const resumed = await response.json();
    expect(resumed.draftPayloads["fictional-form"]).toEqual(savedDraft);
    expect(resumed.lastFormId).toBe("fictional-form-id");
    expect(resumed.lastStepId).toBe("fictional-step");
    expect(io.update).not.toHaveBeenCalled();
  });
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

describe("autosauvegarde staging explicitement activée", () => {
  const values = { fixture: "fictional value" };
  function actions(enabled: boolean, fetcher = vi.fn().mockResolvedValue({ ok: true })) {

    const onSaved = vi.fn();
    const onResetSavedAt = vi.fn();
    return { controller: createDraftAutosaveActions({
      enabled, slug: "c1-changement-situation", bundleRunId: "fictional-run", values,
      onSaved, onResetSavedAt, fetcher,
    }), onSaved, onResetSavedAt, fetcher };
  }

  function enableStagingFixture() {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");
    return isStagingTestPersistenceEnabled();
  }

  it("la production, le flag absent ou staging sans second flag restent sans écriture", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");
    expect(isStagingTestPersistenceEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    delete process.env.NEXT_PUBLIC_STAGING_TEST_PERSISTENCE;
    expect(isStagingTestPersistenceEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "0");
    expect(isStagingTestPersistenceEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");
    expect(isStagingTestPersistenceEnabled()).toBe(true);

    vi.useFakeTimers();
    const disabled = actions(false);
    disabled.controller.scheduleSave("step", "fixture");
    disabled.controller.flushDraft();
    disabled.controller.discardDraft();
    vi.advanceTimersByTime(2_000);
    expect(disabled.fetcher).not.toHaveBeenCalled();
    expect(disabled.onSaved).not.toHaveBeenCalled();
  });

  it("sauve les valeurs les plus récentes et confirme uniquement une réponse 2xx", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const test = actions(enableStagingFixture(), fetcher);
    test.controller.scheduleSave("step-1", "fictional-field");
    test.controller.updateValues({ fixture: "updated fictional value" });
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/pdf/c1-changement-situation/draft");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "PUT", keepalive: true });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
      payload: { fixture: "updated fictional value" }, stepId: "step-1", field: "fictional-field", bundleRunId: "fictional-run",
    });
    expect(test.onSaved).toHaveBeenCalledTimes(1);

    io.cookieGet.mockReturnValue({ value: "fictional-session-id" });
    const savedPayload = JSON.parse(String(fetcher.mock.calls[0][1]?.body)).payload;
    io.findFirst.mockResolvedValue({
      ...existing(), draftPayloads: { "c1-changement-situation": savedPayload },
      lastFormId: "fictional-form-id", lastStepId: "step-1", lastActiveField: "fictional-field",
    });
    const resumedResponse = await readRun(req("/api/documents/bundles/bundle/run", "GET"), { params: Promise.resolve({ id: "bundle" }) });
    expect((await resumedResponse.json()).draftPayloads["c1-changement-situation"]).toEqual(savedPayload);

    test.controller.resetSavedAt();
    test.controller.discardDraft();
    expect(test.onResetSavedAt).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ bundleRunId: "fictional-run" });
    test.controller.dispose();
  });

  it("garde le snapshot après une réponse 401 et le retente sur flush explicite", async () => {
    enableStagingFixture();
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({ ok: true });
    const test = actions(true, fetcher);
    test.controller.scheduleSave("step-1", "fictional-field");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(test.onSaved).not.toHaveBeenCalled();
    const firstBody = fetcher.mock.calls[0][1]?.body;
    test.controller.flushDraft();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.body).toBe(firstBody);
    expect(test.onSaved).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });

  it("sérialise le dernier snapshot derrière le PUT en cours", async () => {
    enableStagingFixture();
    vi.useFakeTimers();
    let resolveFirst!: (value: { ok: boolean }) => void;
    const fetcher = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT" && fetcher.mock.calls.length === 1) {
        return new Promise<{ ok: boolean }>((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ ok: true });
    });
    const test = actions(true, fetcher);
    test.controller.scheduleSave("step-1", "fictional-field");
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetcher).toHaveBeenCalledTimes(1);

    test.controller.updateValues({ fixture: "new fictional value" });
    test.controller.scheduleSave("step-2", "fictional-field");
    test.controller.flushDraft();
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFirst({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      payload: { fixture: "new fictional value" }, stepId: "step-2",
    });
    await Promise.resolve();
    expect(test.onSaved).toHaveBeenCalledTimes(1);
    test.controller.dispose();
  });

  it("diffère DELETE jusqu'à la fin du PUT en cours sans recréer le brouillon", async () => {
    enableStagingFixture();
    vi.useFakeTimers();
    let resolvePut!: (value: { ok: boolean }) => void;
    const fetcher = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") return new Promise<{ ok: boolean }>((resolve) => { resolvePut = resolve; });
      return Promise.resolve({ ok: true });
    });
    const test = actions(true, fetcher);
    test.controller.scheduleSave("step-1", "fictional-field");
    await vi.advanceTimersByTimeAsync(1_500);
    test.controller.discardDraft();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(test.onSaved).not.toHaveBeenCalled();

    resolvePut({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(test.onSaved).not.toHaveBeenCalled();
    test.controller.flushDraft();
    expect(fetcher).toHaveBeenCalledTimes(2);
    test.controller.dispose();
  });
});
