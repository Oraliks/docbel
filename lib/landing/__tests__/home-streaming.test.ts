import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ news: vi.fn(), catalog: vi.fn(), resume: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { news: { findMany: data.news } } }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }));
vi.mock("@/lib/i18n/content", () => ({ localizeRecords: async (_: string, rows: unknown[]) => rows }));
vi.mock("@/lib/outils-catalog", () => ({
  getPublicCatalog: data.catalog,
  filterByAudience: (tools: unknown[]) => tools,
}));
vi.mock("@/lib/landing/resume", () => ({ loadActiveBundleRun: data.resume }));
vi.mock("@/components/docbel/landing/hero", () => ({
  LandingHero: ({ aside }: { aside: ReactNode }) => createElement("section", null, "hero-ready", aside),
  HowItWorksCard: () => "how-it-works",
}));
vi.mock("@/components/docbel/landing/resume-strip", () => ({
  ResumeStrip: ({ run }: { run: { runId: string } }) => `resume:${run.runId}`,
}));
vi.mock("@/components/docbel/landing/wizard-teaser", () => ({ WizardTeaser: () => "wizard-ready" }));
vi.mock("@/components/docbel/landing/trust-band", () => ({ TrustBand: () => "trust-ready" }));
vi.mock("@/components/docbel/landing/tools-row", () => ({
  LandingToolsRow: ({ tools }: { tools: unknown[] }) => `tools:${tools.length}`,
}));
vi.mock("@/components/docbel/landing/editorial-strip", () => ({
  LandingEditorialStrip: () => "news-ready",
}));
vi.mock("@/components/ui/skeletons", () => ({
  LandingAsideSkeleton: () => "resume-pending",
  LandingContentSkeleton: () => "content-pending",
}));

import HomePage from "@/app/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("accueil rendu progressivement", () => {
  beforeEach(() => vi.resetAllMocks());

  it("envoie le héros avant la DB et les outils avant la reprise personnalisée", async () => {
    const news = deferred<unknown[]>();
    const catalog = deferred<unknown[]>();
    const resume = deferred<{ runId: string }>();
    data.news.mockReturnValue(news.promise);
    data.catalog.mockReturnValue(catalog.promise);
    data.resume.mockReturnValue(resume.promise);

    const stream = await renderToReadableStream(createElement(HomePage));
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      const first = decoder.decode((await reader.read()).value);
      expect(first).toContain("hero-ready");
      expect(first).toContain("wizard-ready");
      expect(first).toContain("content-pending");
      expect(first).toContain("resume-pending");
      expect(first).not.toContain("resume:private-run");

      news.resolve([]);
      catalog.resolve([{ popular: true }]);
      const content = decoder.decode((await reader.read()).value);
      expect(content).toContain("tools:1");
      expect(content).not.toContain("resume:private-run");

      resume.resolve({ runId: "private-run" });
      let rest = "";
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
        rest += decoder.decode(chunk.value);
      }
      expect(rest).toContain("resume:private-run");
      expect(rest).not.toContain("how-it-works");
    } finally {
      await reader.cancel();
    }
  });

  it("garde un accueil utilisable si les listes DB échouent", async () => {
    data.news.mockRejectedValue(new Error("unavailable"));
    data.catalog.mockRejectedValue(new Error("unavailable"));
    data.resume.mockResolvedValue(null);
    const stream = await renderToReadableStream(createElement(HomePage));
    const html = await new Response(stream).text();
    expect(html).toContain("hero-ready");
    expect(html).toContain("how-it-works");
    expect(html).toContain("tools:0");
    expect(html).not.toContain("news-ready");
  });
});
