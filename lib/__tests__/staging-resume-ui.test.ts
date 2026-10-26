import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import ReprendrePage from "@/app/reprendre/page";
import { AutoSaveNotice } from "@/components/pdf-forms/auto-save-notice";
import { TemporaryClosureNotice } from "@/components/docbel/temporary-closure-notice";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/confirm-dialog", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => Object.assign(
    (key: string) => `${namespace}.${key}`,
    { rich: (key: string) => `${namespace}.${key}` },
  ),
}));

afterEach(() => vi.unstubAllEnvs());

async function renderPage() {
  const page = await ReprendrePage();
  // The provider type requires children in props when using createElement.
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(
    NextIntlClientProvider,
    { locale: "fr", messages, timeZone: "Europe/Brussels", children: page },
  ));
}

function renderClient(child: ReactNode) {
  // The provider type requires children in props when using createElement.
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(
    NextIntlClientProvider,
    { locale: "fr", messages, timeZone: "Europe/Brussels", children: child },
  ));
}

describe("staging-only resume screen", () => {
  it.each([
    ["production", "1"],
    ["staging", undefined],
    ["staging", "0"],
  ])("keeps the closure copy and suppresses new-dossier actions outside opted-in staging (%s, %s)", async (appEnvironment, flag) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
    if (flag !== undefined) vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", flag);

    const html = await renderPage();
    expect(html).toContain("public.temporaryClosure.consult");
    expect(html).toContain("public.temporaryClosure.existing");
    expect(html).toContain("id=\"resume-code\"");
    expect(html).toContain(messages.public.temporaryClosure.dossier);
    expect(html).not.toContain(messages.public.dossier.resumeNoCodeTitle);
  });

  it("opens the resume page and no-code dossier option only with both staging flags", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");

    const html = await renderPage();
    expect(html).toContain("public.dossier.reprendreTitle");
    expect(html).toContain("public.dossier.reprendreIntro");
    expect(html).toContain("id=\"resume-code\"");
    expect(html).toContain(messages.public.dossier.resumeNoCodeTitle.replaceAll("'", "&#x27;"));
    expect(html).not.toContain(messages.public.temporaryClosure.dossier);
    expect(html).not.toContain(messages.public.design.ephemeralBody);
  });

  it("describes an unsaved stage bundle as pending instead of read-only", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");

    const html = renderClient(createElement(AutoSaveNotice, {
      lastSavedAt: null,
      isPartOfBundle: true,
      serverSaved: false,
    }));
    expect(html).toContain(messages.public.design.ephemeralTitle);
    expect(html).not.toContain(messages.public.design.oldReadOnlyBody);
  });

  it("hides only dossier closure notices during opted-in staging", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", "1");
    expect(renderClient(createElement(TemporaryClosureNotice, { kind: "dossier" }))).toBe("");
    expect(renderClient(createElement(TemporaryClosureNotice, { kind: "existing", compact: true }))).toBe("");
    expect(renderClient(createElement(TemporaryClosureNotice, { kind: "ephemeral", compact: true }))).toBe("");
    expect(renderClient(createElement(TemporaryClosureNotice, { kind: "profile", compact: true }))).toContain(messages.public.temporaryClosure.profile);
  });

  it("keeps the dossier closure notice in production and staging without the opt-in", () => {
    for (const [appEnvironment, flag] of [["production", "1"], ["staging", "0"]]) {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
      vi.stubEnv("NEXT_PUBLIC_STAGING_TEST_PERSISTENCE", flag);
      expect(renderClient(createElement(TemporaryClosureNotice, { kind: "dossier", compact: true }))).toContain(messages.public.temporaryClosure.dossier);
      vi.unstubAllEnvs();
    }
  });
});
