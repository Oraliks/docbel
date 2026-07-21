import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import { LandingHero } from "@/components/docbel/landing/hero";
import { LandingEditorialStrip } from "@/components/docbel/landing/editorial-strip";
import { LandingToolsRow } from "@/components/docbel/landing/tools-row";
import { TrustBand } from "@/components/docbel/landing/trust-band";
import { WizardTeaser } from "@/components/docbel/landing/wizard-teaser";
import { getAudienceFromPath } from "@/lib/audience";
import { filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";
import { loadActiveBundleRun } from "@/lib/landing/resume";
import { formatDate } from "@/lib/i18n/format";
import type { NewsItem } from "@/lib/docbel-data";

export const dynamic = "force-dynamic";

/** Accueil serveur : outils et reprise sont charges en parallele et fail-soft. */
export default async function HomePage() {
  const [articles, catalog, activeRun, locale] = await Promise.all([
    prisma.news.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        category: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        createdAt: true,
        color: true,
        readingTime: true,
        featured: true,
      },
    }).catch(() => []),
    getPublicCatalog().catch(() => []),
    loadActiveBundleRun({ respectDismiss: false }),
    getLocale(),
  ]);

  const persona = getAudienceFromPath("/");
  const citizenTools = filterByAudience(catalog, persona);
  const importantTools = citizenTools.filter((tool) => tool.popular);
  const toolsForRow = importantTools.length ? importantTools : citizenTools;
  const localizedArticles = await localizeRecords(
    "News",
    articles,
    ["title", "excerpt"],
    locale,
  );
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
  }));

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <LandingHero activeRun={activeRun} />
      <WizardTeaser />
      <LandingToolsRow tools={toolsForRow} />
      <LandingEditorialStrip articles={news} />
      <TrustBand />
    </div>
  );
}
