import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import { ActualitesView } from "@/components/docbel/actualites-view";
import type { NewsItem } from "@/lib/docbel-data";
import { resolveArticleImage } from "@/lib/featured-image";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.contenu");
  return {
    title: t("newsMetaTitle"),
    description: t("newsMetaDescription"),
  };
}

export default async function ActualitesRoute({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const [articles, cats] = await Promise.all([
    prisma.news.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: true,
        color: true,
        readingTime: true,
        featured: true,
        image: true,
        heroIllustration: true,
        publishedAt: true,
        createdAt: true,
      },
    }),
    prisma.category.findMany({
      select: { name: true, color: true, illustrationUrl: true },
    }),
  ]);

  const catMap = new Map(cats.map((c) => [c.name, c]));

  // Overlay traductions DB (NL/EN…) sur les champs affichés ; no-op si FR.
  const locale = await getLocale();
  const localized = await localizeRecords("News", articles, ["title", "excerpt"], locale);

  const initialArticles: NewsItem[] = localized.map((article) => ({
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    date: article.publishedAt
      ? new Date(article.publishedAt).toLocaleDateString("fr-BE", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "",
    color: article.color || "#7C3AED",
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: resolveArticleImage({
      heroIllustration: article.heroIllustration,
      manualImage: article.image,
      title: article.title,
      category: article.category,
      categoryColor: catMap.get(article.category)?.color,
      categoryIllustration: catMap.get(article.category)?.illustrationUrl,
      subtitle: article.excerpt,
    }),
  }));

  return <ActualitesView initialArticles={initialArticles} initialCategory={cat} />;
}
