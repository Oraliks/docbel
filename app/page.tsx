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
        image: true,
        heroIllustration: true,
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
    image: article.heroIllustration ?? article.image ?? undefined,
  }));

  return (
    <div className="docbel-home flex w-full flex-col gap-4 sm:gap-5">
      <LandingHero activeRun={activeRun} />
      <WizardTeaser />
      <div
        className={
          news.length > 0
            ? "grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]"
            : "flex flex-col"
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <LandingToolsRow tools={toolsForRow} max={4} />
          <TrustBand />
        </div>
        {news.length > 0 ? <LandingEditorialStrip articles={news} /> : null}
      </div>
    </div>
  );
}
