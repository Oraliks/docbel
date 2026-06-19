import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/news/session";
import { ArticleView } from "@/components/docbel/article-view";
import type { NewsItem } from "@/lib/docbel-data";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

function frDate(value: Date) {
  return new Date(value).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function loadArticle(slug: string) {
  const article = await prisma.news.findUnique({ where: { slug } });
  if (!article) return null;

  if (article.status !== "published") {
    const user = await getCurrentUser();
    if (!user?.isAdmin) return null;
  }
  return article;
}

/**
 * Articles « À lire aussi » : les 3 publications publiées les plus récentes
 * de la MÊME catégorie (hors article courant). Si la catégorie est trop
 * pauvre, on complète avec les plus récentes toutes catégories confondues.
 */
async function loadRelated(slug: string, category: string) {
  const base = {
    status: "published" as const,
    slug: { not: slug },
  };
  const select = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    category: true,
    color: true,
    readingTime: true,
    image: true,
    publishedAt: true,
    createdAt: true,
  };

  const sameCategory = await prisma.news.findMany({
    where: { ...base, category },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select,
  });

  if (sameCategory.length >= 3) return sameCategory;

  // Complète avec les plus récentes (toutes catégories), sans doublon.
  const seen = new Set(sameCategory.map((a) => a.id));
  const fill = await prisma.news.findMany({
    where: base,
    orderBy: { publishedAt: "desc" },
    take: 3 + sameCategory.length,
    select,
  });
  for (const item of fill) {
    if (sameCategory.length >= 3) break;
    if (!seen.has(item.id)) {
      seen.add(item.id);
      sameCategory.push(item);
    }
  }
  return sameCategory;
}

/** Catégories distinctes des articles publiés → liste « Thématiques ». */
async function loadCategories() {
  const rows = await prisma.news.findMany({
    where: { status: "published" },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return rows.map((r) => r.category).filter(Boolean);
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

  const [related, categories] = await Promise.all([
    loadRelated(article.slug, article.category),
    loadCategories(),
  ]);

  const newsItem: NewsItem = {
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    date: frDate(article.publishedAt ?? article.createdAt),
    color: article.color || "#7C3AED",
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: article.image ?? undefined,
    content: article.content,
    // Champs éditoriaux enrichis (Json en base) → typés sur NewsItem.
    keyTakeaway: article.keyTakeaway ?? undefined,
    summary: (article.summary as string[] | null) ?? undefined,
    linkedDocs:
      (article.linkedDocs as { title: string; url: string }[] | null) ??
      undefined,
    faqs: (article.faqs as { q: string; a: string }[] | null) ?? undefined,
  };

  const relatedItems: NewsItem[] = related.map((a) => ({
    id: a.id,
    slug: a.slug,
    tag: a.category,
    title: a.title,
    desc: a.excerpt,
    date: frDate(a.publishedAt ?? a.createdAt),
    color: a.color || "#7C3AED",
    readingTime: a.readingTime ?? undefined,
    image: a.image ?? undefined,
  }));

  return (
    <ArticleView
      article={newsItem}
      related={relatedItems}
      categories={categories}
      accent="#7C3AED"
    />
  );
}
