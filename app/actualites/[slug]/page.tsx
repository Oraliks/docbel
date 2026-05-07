import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/news/session";
import { ArticleView } from "@/components/docbel/article-view";
import type { NewsItem } from "@/lib/docbel-data";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

async function loadArticle(slug: string) {
  const article = await prisma.news.findUnique({ where: { slug } });
  if (!article) return null;

  if (article.status !== "published") {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return null;
  }
  return article;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) {
    return { title: "Article introuvable" };
  }

  const description = article.excerpt;
  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      images: article.image ? [{ url: article.image }] : undefined,
    },
    twitter: {
      card: article.image ? "summary_large_image" : "summary",
      title: article.title,
      description,
      images: article.image ? [article.image] : undefined,
    },
  };
}

export default async function ArticleRoute({ params }: RouteParams) {
  const { slug } = await params;
  const article = await loadArticle(slug);
  if (!article) notFound();

  const newsItem: NewsItem = {
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    date: new Date(article.publishedAt ?? article.createdAt).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    color: article.color || "#C8102E",
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: article.image ?? undefined,
    content: article.content,
  };

  return <ArticleView article={newsItem} accent="#C8102E" />;
}
