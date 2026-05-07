import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ActualitesView } from "@/components/docbel/actualites-view";
import type { NewsItem } from "@/lib/docbel-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Actualités",
  description: "Suivez les informations utiles, les réformes et les changements administratifs.",
};

export default async function ActualitesRoute() {
  const articles = await prisma.news.findMany({
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
      publishedAt: true,
      createdAt: true,
    },
  });

  const initialArticles: NewsItem[] = articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    date: article.publishedAt
      ? new Date(article.publishedAt).toLocaleDateString("fr-FR", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "",
    color: article.color || "#C8102E",
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: article.image ?? undefined,
  }));

  return <ActualitesView initialArticles={initialArticles} />;
}
