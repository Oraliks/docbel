import { Suspense, cache } from "react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import { LandingHero, HowItWorksCard } from "@/components/docbel/landing/hero";

import { LandingAsideSkeleton, LandingContentSkeleton } from "@/components/ui/skeletons";
import { LandingEditorialStrip } from "@/components/docbel/landing/editorial-strip";
import { LandingToolsRow } from "@/components/docbel/landing/tools-row";
import { TrustBand } from "@/components/docbel/landing/trust-band";
import { WizardTeaser, loadHomeCatalog } from "@/components/docbel/landing/wizard-teaser";
import { buttonVariants } from "@/components/ui/button";


import { loadActiveBundleRun } from "@/lib/landing/resume";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/docbel-data";

export const dynamic = "force-dynamic";

// Le CTA et le panneau partagent la même reprise réelle dans cette requête.
const loadHomeRun = cache(() => loadActiveBundleRun({ respectDismiss: false }));

async function HomeResume() {
  const activeRun = await loadHomeRun();
  if (!activeRun) return <HowItWorksCard />;
  const t = await getTranslations("public.home");
  return (
    <section className="flex h-full flex-col rounded-[28px] border border-[color:var(--glass-border)] bg-[color:var(--glass-accent-soft)] p-6 sm:p-8" aria-labelledby="home-resume-title">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-soft)]">{t("guidedResumeEyebrow")}</p>
      <h2 id="home-resume-title" className="mt-5 text-[24px] font-semibold leading-tight">{activeRun.name}</h2>
      <p className="mt-4 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{t("resumeProgress", { completed: activeRun.completed, total: activeRun.total })}</p>
      <Link href={`/d/${encodeURIComponent(activeRun.slug)}?bundleRun=${encodeURIComponent(activeRun.runId)}`} className={cn(buttonVariants({ size: "lg" }), "mt-auto min-h-12 w-full rounded-[14px]")}>
        {t("designResume")}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </section>
  );
}

async function HomeActions() {
  const [activeRun, t] = await Promise.all([loadHomeRun(), getTranslations("public.home")]);
  const href = activeRun
    ? `/d/${encodeURIComponent(activeRun.slug)}?bundleRun=${encodeURIComponent(activeRun.runId)}`
    : "/mon-dossier";
  return (
    <div className="flex flex-1 flex-col gap-2 sm:flex-none">
      <Link href={href} className={cn(buttonVariants({ size: "lg" }), "min-h-14 rounded-[14px] px-5 text-sm")}>
        {activeRun ? t("designResume") : t("guidedCta")}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
      {activeRun ? <Link href="/mon-dossier" className="min-h-8 text-xs text-[color:var(--glass-ink-soft)] underline underline-offset-4">{t("designOtherStart")}</Link> : null}
    </div>
  );
}

/** Les lectures DB secondaires ne bloquent ni le titre ni l'orientation. */
async function HomeContent() {
  const [articles, catalog, locale] = await Promise.all([
    prisma.news.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true, slug: true, category: true, title: true, excerpt: true,
        publishedAt: true, createdAt: true, color: true, readingTime: true,
        featured: true, image: true, heroIllustration: true,
      },
    }).catch(() => []),
    // null exprime une erreur ; [] exprime un catalogue réellement vide.
    loadHomeCatalog(),
    getLocale(),
  ]);
  const citizenTools = catalog ?? [];
  const importantTools = citizenTools.filter((tool) => tool.popular);
  const localizedArticles = await localizeRecords("News", articles, ["title", "excerpt"], locale);
  const news: NewsItem[] = localizedArticles.map((article) => ({
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    date: formatDate(article.publishedAt ?? article.createdAt, locale),
    color: article.color || "var(--glass-accent-deep)",
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: article.heroIllustration ?? article.image ?? undefined,
  }));

  return (
    <div className={news.length > 0 ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]" : "flex flex-col"}>
      <LandingToolsRow tools={importantTools.length ? importantTools : citizenTools} unavailable={catalog === null} max={4} />
      {news.length > 0 ? <LandingEditorialStrip articles={news} /> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="docbel-home flex w-full flex-col gap-9 py-5 sm:gap-12 sm:py-10">
      <LandingHero
        actions={<Suspense fallback={null}><HomeActions /></Suspense>}
        aside={<Suspense fallback={<LandingAsideSkeleton />}><HomeResume /></Suspense>}
      />
      <Suspense fallback={<LandingContentSkeleton />}><WizardTeaser /></Suspense>
      <TrustBand />
      <Suspense fallback={<LandingContentSkeleton />}><HomeContent /></Suspense>
    </div>
  );
}
