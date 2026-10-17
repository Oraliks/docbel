import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FormPayload } from "../pdf-forms/types";
import type { RegulatoryDecision } from "../regulatory-decision/types";

const io = vi.hoisted(() => ({
  session: vi.fn(), cookies: vi.fn(), source: vi.fn(),
  findBundle: vi.fn(), findRun: vi.fn(), findRuns: vi.fn(), findFirst: vi.fn(),
  createRun: vi.fn(), updateRun: vi.fn(), updateRuns: vi.fn(), deleteRuns: vi.fn(),
  findForm: vi.fn(), findForms: vi.fn(), log: vi.fn(), event: vi.fn(), raw: vi.fn(),
  transaction: vi.fn(), deleteRelated: vi.fn(), unlink: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: io.session } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: io.cookies }));
vi.mock("@/lib/pdf-forms/storage", () => ({ readSourcePdf: io.source }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true }), getClientIp: () => "127.0.0.1",
}));
vi.mock("@/lib/prisma", () => ({
  withDbRetry: async (operation: () => Promise<unknown>) => operation(),
  prisma: {
    documentBundle: { findUnique: io.findBundle },
    bundleRun: { findUnique: io.findRun, findMany: io.findRuns, findFirst: io.findFirst,
      create: io.createRun, update: io.updateRun, updateMany: io.updateRuns, deleteMany: io.deleteRuns },
    pdfForm: { findUnique: io.findForm, findMany: io.findForms },
    pdfFormSubmissionLog: { create: io.log, createMany: io.log },
    bundleAnalyticsEvent: { create: io.event },
    baremeFile: { findFirst: async () => null },
    $executeRaw: io.raw, $transaction: io.transaction,
  },
}));

import * as creation from "../../app/api/documents/bundles/[id]/run/route";
import * as generate from "../../app/api/pdf/[slug]/generate/route";
import * as cron from "../../app/api/cron/bundle-runs-purge/route";
import { initializePersonalSituationSnapshot } from "../regulatory-decision/personal-situation";
import { withPersonalSituationTrace } from "../regulatory-decision/personal-situation-change";
import { regenerateOneDocument } from "../bundles/regenerate-pdfs";
import { deleteUserAndPersonalData } from "../users-delete";
import { READONLY_COOKIE } from "../admin/readonly-guard";
import { C1_FAMILLE } from "../pdf-forms/seed/c1/famille";
import { buildValidator, isFieldVisible, visiblePayload } from "../pdf-forms/validation";
import * as filler from "../pdf-forms/filler";
import { deriveFamilyFactsFromC1 } from "../regulatory-decision/personal-situation-change";

const slug = "changement-situation-personnelle";
const now = new Date("2026-10-17T12:00:00Z");
const fields = C1_FAMILLE;
const isolated: FormPayload = { statutFamilial: "isole", pensionAlimentaire: "non", habiteEnColocation: "non" };
const spouse = { prenom: "Synthetic", nom: "Example", dateNaissance: "1980-01-01", lien: "epoux",
  typeRevenuPro: "aucun", revenuRemplacement: "aucun" };
const form = { id: "c1", slug: "c1-changement-situation", title: "C1", description: "",
  issuer: "ONEM", status: "published", active: true, allowDownload: true,
  defaultLocale: "fr", version: 1, fields, triggers: [], technicalSchema: [],
  sourceStoragePath: "synthetic.pdf", sourceFileName: "synthetic.pdf" };
function bundle(bundleSlug = slug) {
  return { id: "bundle", slug: bundleSlug, name: "Dossier", active: true, eligibilityQuestions: [],
    items: [{ id: "item", pdfFormId: form.id, pdfForm: form, order: 0, required: true, condition: null }] };
}
function fixture(snapshot: RegulatoryDecision | null = null) {
  return { id: "run", bundleId: "bundle", bundle: bundle(), userId: "owner" as string | null,
    sessionId: "anonymous-session", status: "in_progress", startedAt: new Date("2026-10-01T10:00:00Z"),
    completedAt: null as Date | null, anonymizedAt: null, regulatoryDecisionSnapshot: snapshot,
    payloads: {} as Record<string, FormPayload>, completedTemplateIds: [] as string[],
    eligibilityAnswers: {} as Record<string, string>, orientationAnswers: null, draftPayloads: null };
}
let current: ReturnType<typeof fixture> | null;
const req = (body?: unknown) => new NextRequest("https://example.invalid/api/run", {
  method: "POST", headers: { "content-type": "application/json", cookie: "beldoc-bundle-session=anonymous-session" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const params = { params: Promise.resolve({ id: "bundle" }) };
const start = (body?: unknown) => creation.POST(req(body), params);
const validateC1 = (delivery = "save", payload: FormPayload = isolated) =>
  generate.POST(req({ consent: true, bundleRunId: "run", delivery, payload }),
    { params: Promise.resolve({ slug: form.slug }) });
function selectionOnly(snapshot: RegulatoryDecision) {
  expect(snapshot).toMatchObject({ status: "decided", scenarioId: "personal-situation-c1", bundleSlug: slug,
    ruleIds: ["personal-situation-c1-workflow"], ruleVersions: { "personal-situation-c1-workflow": 1 },
    sourceRuleIds: ["formulaire_c1", "situation_familiale_c1"], decidedAt: now.toISOString() });
  expect(snapshot.factsUsed).toEqual({ "entry.dossier": { value: slug, origin: "system" } });
  expect(snapshot.legalWarning).toContain("ONEM");
  expect(Object.keys(snapshot).sort()).toEqual([
    "status", "scenarioId", "bundleSlug", "ruleIds", "ruleVersions", "factsUsed", "missingFacts",
    "explanation", "sourceRuleIds", "legalWarning", "decidedAt",
  ].sort());
}

beforeEach(() => {
  vi.resetAllMocks();
  // Only Date is faked: async PDF and server services keep their real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  current = null;
  io.session.mockResolvedValue({ user: { id: "owner" }, session: {} });
  io.cookies.mockResolvedValue({ get: (name: string) => name === "beldoc-bundle-session"
    ? { value: "anonymous-session" } : undefined, set: vi.fn() });
  io.findBundle.mockResolvedValue(bundle());
  io.findFirst.mockImplementation(async () => current);
  io.findRun.mockImplementation(async ({ where }) => where.id ? current : null);
  io.findRuns.mockResolvedValue([]);
  io.createRun.mockImplementation(async ({ data }) => {
    current = { ...fixture(), ...data, regulatoryDecisionSnapshot: data.regulatoryDecisionSnapshot ?? null };
    return current;
  });
  io.updateRun.mockImplementation(async ({ data }) => {
    current = { ...current!, ...data };
    return current;
  });
  io.findForm.mockResolvedValue(form);
  io.findForms.mockResolvedValue([form]);
  io.source.mockImplementation(() => readFile(join(process.cwd(), "private/pdfs/C1_FR.pdf")));
  io.deleteRuns.mockResolvedValue({ count: 0 });
  io.raw.mockResolvedValue(1);
  io.transaction.mockImplementation(async (operation) => operation({
    userProfile: { deleteMany: io.deleteRelated }, pdfFormDraft: { deleteMany: io.deleteRelated },
    bundleRun: { updateMany: io.updateRuns }, booking: { updateMany: io.unlink },
    bookingWaitlist: { updateMany: io.unlink }, session: { deleteMany: io.deleteRelated },
    user: { delete: io.deleteUser },
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("selection at new run creation", () => {
  it.each([true, false])("creates an atomic selection for an authenticated=%s citizen", async (authenticated) => {
    if (!authenticated) io.session.mockResolvedValue(null);
    const response = await start({ regulatoryDecisionSnapshot: { officialOnemState: { onemCode: "invented" } },
      slug: "another-bundle", factsUsed: { "family.category": "A" } });
    expect(response.status).toBe(201);
    selectionOnly((await response.json()).regulatoryDecisionSnapshot);
    expect(io.createRun).toHaveBeenCalledOnce();
    const data = io.createRun.mock.calls[0][0].data;
    expect(data.startedAt.toISOString()).toBe(data.regulatoryDecisionSnapshot.decidedAt);
    expect(data.userId).toBe(authenticated ? "owner" : null);
    expect(io.updateRun).not.toHaveBeenCalled();
    expect(io.updateRuns).not.toHaveBeenCalled();
  });

  it("uses the DB slug and does not initialize another bundle despite client input", async () => {
    io.findBundle.mockResolvedValue(bundle("other-bundle"));
    const response = await start({ slug, regulatoryDecisionSnapshot: initializePersonalSituationSnapshot(slug, null, now) });
    expect(response.status).toBe(201);
    expect(io.createRun.mock.calls[0][0].data).not.toHaveProperty("regulatoryDecisionSnapshot");
    expect((await response.json()).regulatoryDecisionSnapshot).toBeNull();
  });

  it("is pure and idempotent, including historical and official properties", () => {
    const first = initializePersonalSituationSnapshot(slug, null, now)!;
    selectionOnly(first);
    const historical = { ...first, officialOnemState: { onemCode: "B / 60B" },
      isolatedHouseholdAssessmentHistory: [], temporalHistory: [{
        onemCode: "110&1M" as const, familyCategory: "A" as const,
        effectiveFrom: "2026-01-01", effectiveUntil: "2026-06-30", reassessmentAt: "2026-07-01",
        ruleIds: ["historical-rule"], ruleVersions: { "historical-rule": 1 }, sourceRuleIds: [],
        factsUsed: {}, decidedAt: "2026-01-01T00:00:00Z",
      }],
      historicalExtension: { original: true } };
    const before = structuredClone(historical);
    expect(initializePersonalSituationSnapshot(slug, first, new Date("2027-01-01"))).toBe(first);
    expect(initializePersonalSituationSnapshot("other", historical, new Date("2027-01-01"))).toBe(historical);
    expect(historical).toEqual(before);
    expect(initializePersonalSituationSnapshot("other", null, now)).toBeNull();
  });

  it.each([false, true])("preserves an existing snapshot or legacy null on forceNew reuse=%s", async (forceNew) => {
    for (const snapshot of [null, { ...initializePersonalSituationSnapshot(slug, null, now)!,
      officialOnemState: { onemCode: "B / 60B" }, temporalHistory: [] }]) {
      current = fixture(snapshot);
      io.findRuns.mockResolvedValue([current]);
      const before = structuredClone(current);
      expect((await start({ forceNew })).status).toBe(200);
      expect(current).toEqual(before);
    }
    expect(io.createRun).not.toHaveBeenCalled();
    expect(io.updateRun).not.toHaveBeenCalled();
  });

  it("refreshes eligibility on a legacy run without backfilling its snapshot", async () => {
    current = fixture();
    expect((await start({ eligibilityAnswers: { answer: "yes" } })).status).toBe(200);
    expect(io.updateRun.mock.calls[0][0].data).toEqual({ eligibilityAnswers: { answer: "yes" } });
    expect(current!.regulatoryDecisionSnapshot).toBeNull();
  });

  it("clones answers and completion but creates a fresh selection without source decisions", async () => {
    const old = withPersonalSituationTrace(initializePersonalSituationSnapshot(slug, null, new Date("2026-10-01")),
      { statutFamilial: "isole" }, now)!;
    const source = { ...fixture({ ...old, officialOnemState: { onemCode: "B / 60B" } }),
      payloads: { c1: { statutFamilial: "isole" } }, completedTemplateIds: ["c1"],
      eligibilityAnswers: { answer: "yes" }, orientationAnswers: { slug } };
    const before = structuredClone(source);
    io.findRuns.mockResolvedValue([source]);
    const response = await start({ forceNew: true });
    expect(response.status).toBe(201);
    const created = await response.json();
    selectionOnly(created.regulatoryDecisionSnapshot);
    expect(created).toMatchObject({ payloads: source.payloads, completedTemplateIds: source.completedTemplateIds,
      eligibilityAnswers: source.eligibilityAnswers, orientationAnswers: source.orientationAnswers,
      clonedFromDate: source.startedAt.toISOString() });
    expect(source).toEqual(before);
  });

  it.each([true, false])("keeps GET ownership filtering for authenticated=%s, without writing", async (authenticated) => {
    if (!authenticated) io.session.mockResolvedValue(null);
    current = fixture();
    expect((await creation.GET(req(), params)).status).toBe(200);
    expect(io.findFirst.mock.calls[0][0].where).toMatchObject(authenticated
      ? { bundleId: "bundle", userId: "owner" } : { bundleId: "bundle", sessionId: "anonymous-session" });
    expect(io.createRun).not.toHaveBeenCalled();
    expect(io.updateRun).not.toHaveBeenCalled();
  });

  it.each(["demo", "impersonation"])("keeps the real %s read-only guard before any mutation", async (kind) => {
    io.session.mockResolvedValue({ user: { id: "owner", email: kind === "demo" ? "demo+test@docbel.local" : "test@example.invalid" },
      session: { impersonatedBy: kind === "impersonation" ? "admin" : null } });
    io.cookies.mockResolvedValue({ get: (name: string) => name === READONLY_COOKIE ? { value: "1" } : undefined,
      set: vi.fn() });
    expect((await start()).status).toBe(403);
    expect((await creation.PATCH(req({ eligibilityAnswers: {} }), params)).status).toBe(403);
    expect((await validateC1()).status).toBe(403);
    expect(io.findBundle).not.toHaveBeenCalled();
    expect(io.createRun).not.toHaveBeenCalled();
    expect(io.updateRun).not.toHaveBeenCalled();
  });
});

describe("existing C1 enrichment and document lifecycle", () => {
  it.each(["save", "download"])("creation then %s enriches through the real C1 helper", async (delivery) => {
    await start();
    const original = current!.regulatoryDecisionSnapshot!;
    current!.regulatoryDecisionSnapshot = { ...original, officialOnemState: { onemCode: "B / 60B" }, temporalHistory: [] };
    if (delivery === "download") current!.completedTemplateIds = [form.id];
    const response = await validateC1(delivery);
    expect(response.status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({
      decidedAt: original.decidedAt, officialOnemState: { onemCode: "B / 60B" }, temporalHistory: [],
      householdAssessment: { composition: "alone" }, personalSituationTrace: { version: 1 },
    });
    expect(original).not.toHaveProperty("householdAssessment");
    expect(current!.payloads.c1).toMatchObject(isolated);
    expect(response.headers.get("content-type")).toContain(delivery === "save" ? "application/json" : "application/pdf");
  });

  it("does not backfill legacy null during C1 validation", async () => {
    current = fixture();
    expect((await validateC1()).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toBeNull();
    expect(withPersonalSituationTrace(null, { statutFamilial: "isole" }, now)).toBeNull();
  });

  it.each(["save", "download"])("filters stale spouse answers transitively before %s assessment and PDF", async (delivery) => {
    await start();
    const officialOnemState = { onemCode: "B / 60B", recordedAt: "2026-10-01" };
    current!.regulatoryDecisionSnapshot = { ...current!.regulatoryDecisionSnapshot!, officialOnemState };
    expect((await validateC1("save", { statutFamilial: "cohabite", cohabiteType: "menage-commun",
      cohabitants: [spouse] })).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ householdAssessment: { composition: "spouse_or_partner" } });
    const changedBranch: FormPayload = { ...current!.payloads.c1, ...isolated };
    // Reproduce the client's single-pass submission using its real visibility predicate.
    const clientPayload = Object.fromEntries(fields.filter((field) => field.id in changedBranch
      && isFieldVisible(field.visibleIf, changedBranch)).map((field) => [field.id, changedBranch[field.id]]));
    expect(clientPayload).not.toHaveProperty("cohabiteType");
    expect(clientPayload).toHaveProperty("cohabitants");
    const expectedVisible = visiblePayload(fields, buildValidator(fields, "fr").parse(clientPayload) as FormPayload);
    const fillSpy = vi.spyOn(filler, "fillForm");
    const response = await validateC1(delivery, clientPayload);
    expect(response.status).toBe(200);
    expect(current!.payloads.c1).toEqual(expectedVisible);
    expect(current!.payloads.c1).not.toHaveProperty("cohabitants");
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ officialOnemState,
      householdAssessment: { composition: "alone", expectedCategory: "N", status: "probable" },
      personalSituationTrace: { companions: [] } });
    if (delivery === "download") {
      expect(fillSpy.mock.calls[0][2]).toEqual(expectedVisible);
      const pdf = await PDFDocument.load(await response.arrayBuffer());
      expect(pdf.getForm().getCheckBox("jhabite seul 9").isChecked()).toBe(true);
      expect(pdf.getForm().getTextField("Personne1_Prenom").getText() ?? "").toBe("");
    } else {
      expect(fillSpy).not.toHaveBeenCalled();
    }
  });

  it("drops stale pension facts after returning from an isolated to a common household", async () => {
    await start();
    const oldPension: FormPayload = { ...isolated, pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main",
      pensionAlimentairePaiementEffectif: "oui", pensionAlimentaireBaseJuridique: "decision-judiciaire",
      pensionAlimentaireBeneficiaire: "enfant-mineur" };
    expect((await validateC1("save", oldPension)).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ householdAssessment: { expectedCategory: "A" } });
    expect((await validateC1("save", { ...oldPension, statutFamilial: "cohabite",
      cohabiteType: "menage-commun", cohabitants: [spouse] })).status).toBe(200);
    for (const key of ["pensionAlimentaire", "statutJugementPensionAlimentaire", "pensionAlimentairePaiementEffectif",
      "pensionAlimentaireBaseJuridique", "pensionAlimentaireBeneficiaire"]) {
      expect(current!.payloads.c1).not.toHaveProperty(key);
    }
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ householdAssessment: { composition: "spouse_or_partner" } });
  });

  it.each(["save", "download"])("keeps a partial alimony claim unknown through %s until payment facts are supplied", async (delivery) => {
    await start();
    const officialOnemState = { onemCode: "B / 60B" };
    current!.regulatoryDecisionSnapshot = { ...current!.regulatoryDecisionSnapshot!, officialOnemState };
    if (delivery === "download") current!.completedTemplateIds = [form.id];
    const partial: FormPayload = { ...isolated, pensionAlimentaire: "oui", statutJugementPensionAlimentaire: "en-main" };
    const parsed = buildValidator(fields, "fr").parse(partial) as FormPayload;
    expect(deriveFamilyFactsFromC1(parsed).isolated?.alimony?.paid).toBeUndefined();
    expect((await validateC1(delivery, partial)).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ officialOnemState,
      householdAssessment: { status: "needs_information", expectedCategory: null,
        missingFacts: expect.arrayContaining(["isolated.alimony.paid", "isolated.alimony.admissibleBasis", "isolated.alimony.beneficiary"]) } });
    expect((await validateC1(delivery, { ...partial, pensionAlimentairePaiementEffectif: "oui" })).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ officialOnemState,
      householdAssessment: { status: "needs_information", expectedCategory: null } });
    const complete = { ...partial, pensionAlimentairePaiementEffectif: "oui",
      pensionAlimentaireBaseJuridique: "decision-judiciaire", pensionAlimentaireBeneficiaire: "enfant-mineur" };
    expect((await validateC1(delivery, complete)).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ officialOnemState,
      householdAssessment: { status: "probable", expectedCategory: "A" } });
    expect((await validateC1(delivery, { ...complete, pensionAlimentairePaiementEffectif: "non" })).status).toBe(200);
    expect(current!.regulatoryDecisionSnapshot).toMatchObject({ officialOnemState,
      householdAssessment: { status: "probable", expectedCategory: "N" } });
  });

  it.each(["save", "download"])("refuses a foreign run before %s can enrich it", async (delivery) => {
    current = { ...fixture(), userId: "someone-else" };
    expect((await validateC1(delivery)).status).toBe(404);
    expect(io.updateRun).not.toHaveBeenCalled();
    expect(io.updateRuns).not.toHaveBeenCalled();
    expect(io.source).not.toHaveBeenCalled();
  });

  it("regenerates a completed cloned document without recalculating a family assessment", async () => {
    current = { ...fixture(initializePersonalSituationSnapshot(slug, null, now)),
      completedTemplateIds: ["c1"], payloads: { c1: { statutFamilial: "isole" } } };
    const snapshot = current.regulatoryDecisionSnapshot;
    const result = await regenerateOneDocument("run", "c1", { userId: "owner", sessionId: null });
    expect(result?.doc.bytes.length).toBeGreaterThan(0);
    expect(current.regulatoryDecisionSnapshot).toBe(snapshot);
    selectionOnly(snapshot!);
    expect(io.updateRun).not.toHaveBeenCalled();
    expect(io.updateRuns).not.toHaveBeenCalled();
  });
});

describe("snapshot minimization through existing retention", () => {
  it("clears the snapshot in account deletion within its existing transaction", async () => {
    await deleteUserAndPersonalData("owner");
    expect(io.transaction).toHaveBeenCalledOnce();
    expect(io.updateRuns).toHaveBeenCalledExactlyOnceWith({ where: { userId: "owner" },
      data: expect.objectContaining({ regulatoryDecisionSnapshot: Prisma.DbNull, anonymizedAt: now }) });
    expect(io.updateRuns.mock.invocationCallOrder[0]).toBeLessThan(io.deleteUser.mock.invocationCallOrder[0]);
  });

  it("anonymizes the snapshot with SQL NULL while draft-only purge retains it and activity dates", async () => {
    vi.stubEnv("CRON_SECRET", "synthetic-cron-secret");
    const response = await cron.GET(new NextRequest("https://example.invalid/api/cron/bundle-runs-purge", {
      headers: { authorization: "Bearer synthetic-cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(io.deleteRuns).toHaveBeenCalledExactlyOnceWith({
      where: { updatedAt: { lt: new Date("2026-04-20T12:00:00Z") } },
    });
    const [anonymization, draftPurge] = io.raw.mock.calls;
    const sql = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");
    expect(sql(anonymization)).toContain('"regulatoryDecisionSnapshot" = NULL');
    expect(anonymization.slice(1)).toEqual([now, new Date("2026-08-18T12:00:00Z")]);
    expect(sql(draftPurge)).not.toContain("regulatoryDecisionSnapshot");
    expect(draftPurge.slice(1)).toEqual([new Date("2026-10-10T12:00:00Z")]);
    for (const call of [anonymization, draftPurge]) {
      expect(sql(call).split("WHERE")[0]).not.toMatch(/"updatedAt"\s*=/);
    }
  });
});
