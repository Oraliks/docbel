import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { temporaryClosureForPath } from "@/lib/public-access";
import { TemporaryClosureNotice } from "@/components/docbel/temporary-closure-notice";
import { AutoSaveNotice } from "@/components/pdf-forms/auto-save-notice";
import { PdfFormRunner } from "@/components/pdf-forms/pdf-form-runner";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";
import { DemandeList } from "@/components/docbel/demande-list";
import type { PublicForm } from "@/lib/pdf-forms/public-serializer";
import type { DemandeSummary } from "@/lib/bundles/demande-summary";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => vi.fn() }));
const render = (child: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(NextIntlClientProvider, { locale: "fr", messages, timeZone: "Europe/Brussels" }, child));

describe("temporary public transition", () => {
  it.each(["/inscription", "/inscription/partenaire", "/inscription/employeur"])("closes signup page %s", (path) => expect(temporaryClosureForPath(path)).toBe("signup"));
  it.each(["/rendez-vous", "/rendez-vous/guichets", "/fixture/rendez-vous"])("closes new booking page %s", (path) => expect(temporaryClosureForPath(path)).toBe("booking"));
  it.each(["/rendez-vous/gestion/fixture-token", "/login", "/admin", "/partenaire/booking", "/outils", "/document/fixture", "/reprendre", "/profil"])("preserves useful route %s", (path) => expect(temporaryClosureForPath(path)).toBeNull());
  it("explains booking closure without collecting new contact details", () => {
    const html = render(createElement(TemporaryClosureNotice, { kind: "booking" }));
    expect(html).toContain("temporairement suspendues");
    expect(html).toContain("lien reçu");
    expect(html).not.toContain("<input");
    expect(html).toContain('href="/login"');
  });
  it("keeps the existing resume-code form and removes new dossier offers", () => {
    const html = render(createElement(ResumeForm));
    expect(html).toContain('id="resume-code"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain("Commencer un dossier");
    expect(html).toContain("temporairement suspendus");
  });
  it("never claims server autosave even for an authenticated standalone form", () => {
    const html = render(createElement(AutoSaveNotice, { lastSavedAt: new Date(), serverSaved: true, isPartOfBundle: false }));
    expect(html).toContain("ne sont pas sauvegardées");
    expect(html).not.toContain("enregistrées automatiquement");
  });
  it("renders existing answers read-only and preserves the exact request link", () => {
    const form: PublicForm = { id: "fixture", slug: "fixture", title: "Fixture", description: null, issuer: null, version: 1, defaultLocale: "fr", locales: ["fr"], allowDownload: true, allowDoccle: false, allowItsme: false, triggers: [], fields: [{ id: "firstName", type: "text", required: true, label: { fr: "Prénom" } }] };
    const html = render(createElement(PdfFormRunner, { form, bundleRunId: "existing/id", bundleSlug: "fixture", draftValues: { firstName: "Synthetic fixture" } }));
    expect(html).toContain('<fieldset disabled=""');
    expect(html).toContain("Synthetic fixture");
    expect(html).toContain("bundleRun=existing%2Fid");
    expect(html).not.toContain('type="submit"');
  });
  it("lists two saved requests with their own ids and without create/abandon actions", () => {
    const demandes: DemandeSummary[] = ["old-a", "old-b"].map((runId, index) => ({ runId, index: index + 1, lifecycle: "in_progress", completed: 0, total: 2, startedAtISO: "2026-10-20T10:00:00Z" }));
    const html = render(createElement(DemandeList, { bundleId: "fixture", slug: "fixture", bundleName: "Fixture", demandes }));
    expect(html).toContain("bundleRun=old-a");
    expect(html).toContain("bundleRun=old-b");
    expect(html).not.toContain("Abandonner");
    expect(html).not.toContain("Nouvelle demande");
    expect(html).toContain("modification est temporairement suspendue");
  });
});
