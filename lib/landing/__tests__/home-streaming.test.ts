import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({ news: vi.fn(), catalog: vi.fn(), resume: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { news: { findMany: data.news } } }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr", getTranslations: async () => (key: string) => key }));
vi.mock("@/lib/i18n/content", () => ({ localizeRecords: async (_: string, rows: unknown[]) => rows }));
vi.mock("@/lib/landing/resume", () => ({ loadActiveBundleRun: data.resume }));
vi.mock("@/components/docbel/landing/hero", () => ({
  LandingHero: ({ aside, actions }: { aside: ReactNode; actions: ReactNode }) => createElement("section", null, "hero-ready", actions, aside),
  HowItWorksCard: () => "how-it-works",
}));
vi.mock("@/components/docbel/landing/wizard-teaser", () => ({
  WizardTeaser: () => "wizard-ready",
  // Contract of the shared catalogue loader: null denotes loading failure.
  loadHomeCatalog: () => data.catalog().catch(() => null),
}));
vi.mock("@/components/docbel/landing/trust-band", () => ({ TrustBand: () => "trust-ready" }));
vi.mock("@/components/docbel/landing/tools-row", () => ({
  LandingToolsRow: ({ tools, unavailable }: { tools: unknown[]; unavailable: boolean }) => `tools:${tools.length}:${unavailable ? "unavailable" : "available"}`,
}));
vi.mock("@/components/docbel/landing/editorial-strip", () => ({ LandingEditorialStrip: () => "news-ready" }));
vi.mock("@/components/ui/skeletons", () => ({
  LandingAsideSkeleton: () => "resume-pending",
  LandingContentSkeleton: () => "content-pending",
}));

import HomePage from "@/app/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

describe("accueil rendu progressivement", () => {
  beforeEach(() => vi.resetAllMocks());

  it("envoie le héros avant la DB et les outils avant la reprise personnalisée", async () => {
    const news = deferred<unknown[]>();
    const catalog = deferred<unknown[]>();
    const resume = deferred<{ runId: string; slug: string; name: string; completed: number; total: number }>();
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
      expect(first).not.toContain("bundleRun=private-run");
      news.resolve([]);
      catalog.resolve([{ popular: true }]);
      const content = decoder.decode((await reader.read()).value);
      expect(content).toContain("tools:1:available");
      expect(content).not.toContain("bundleRun=private-run");
      resume.resolve({ runId: "private-run", slug: "synthetic", name: "Démarche synthétique", completed: 1, total: 2 });
      let rest = "";
      for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) rest += decoder.decode(chunk.value);
      expect(rest).toContain("bundleRun=private-run");
      expect(rest).toContain("Démarche synthétique");
      expect(rest).not.toContain("demarrer=1");
      expect(rest).not.toContain("how-it-works");
    } finally {
      await reader.cancel();
    }
  });

  it("distingue une erreur de catalogue du catalogue vide", async () => {
    data.news.mockRejectedValue(new Error("unavailable"));
    data.catalog.mockRejectedValue(new Error("unavailable"));
    data.resume.mockResolvedValue(null);
    const html = await new Response(await renderToReadableStream(createElement(HomePage))).text();
    expect(html).toContain("hero-ready");
    expect(html).toContain("how-it-works");
    expect(html).toContain("tools:0:unavailable");
    expect(html).not.toContain("news-ready");
  });

  it("représente l’absence réelle d’outils sans annoncer une panne", async () => {
    data.news.mockResolvedValue([]);
    data.catalog.mockResolvedValue([]);
    data.resume.mockResolvedValue(null);
    const html = await new Response(await renderToReadableStream(createElement(HomePage))).text();
    expect(html).toContain("hero-ready");
    expect(html).toContain("tools:0:available");
    expect(html).not.toContain("tools:0:unavailable");
    expect(html).not.toContain("news-ready");
  });
});
