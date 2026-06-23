import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecord, localizeRecords } from "@/lib/i18n/content";
import { getCurrentUser } from "@/lib/news/session";
import { ArticleView } from "@/components/docbel/article-view";
import type { NewsItem } from "@/lib/docbel-data";
import { resolveArticleImage } from "@/lib/featured-image";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ slug: string }> };

function frDate(value: Date) {
  return new Date(value).toLocaleDateString("fr-BE", {
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
    heroIllustration: true,
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

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadArticle(slug);
  if (!loaded) {
    const t = await getTranslations("public.contenu");
    return { title: t("articleNotFoundTitle") };
  }

  // Overlay traductions DB (NL/EN…) sur le titre/description des metadata.
  const locale = await getLocale();
  const article = await localizeRecord(
    "News",
    loaded,
    ["title", "excerpt", "content", "keyTakeaway"],
    locale,
  );

  // Build the absolute base URL per-request from forwarded headers so the OG
  // tags resolve correctly on localhost, Netlify preview, and prod (same
  // approach as app/sitemap.xml/route.ts).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "docbel.be";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const canonical = `${base}/actualites/${slug}`;
  const description = article.excerpt;

  // Fetch the category's color + illustration for the branded OG image.
  const cat = article.category
    ? await prisma.category.findUnique({
        where: { name: article.category },
        select: { color: true, illustrationUrl: true },
      })
    : null;

  // Image unique = illustration (hero) ; repli image héritée, puis carte brandée.
  const ogImage = resolveArticleImage({
    heroIllustration: article.heroIllustration,
    manualImage: article.image,
    title: article.title,
    category: article.category,
    categoryColor: cat?.color,
    categoryIllustration: cat?.illustrationUrl,
    subtitle: article.excerpt,
    base,
  });

  return {
    title: article.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: canonical,
      siteName: "Docbel",
      publishedTime: article.publishedAt?.toISOString(),
      images: [
        { url: ogImage, width: 1280, height: 720, alt: article.title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ArticleRoute({ params }: RouteParams) {
  const { slug } = await params;
  const [loaded, user] = await Promise.all([loadArticle(slug), getCurrentUser()]);
  if (!loaded) notFound();

  // Overlay traductions DB (NL/EN…) ; no-op si FR.
  const locale = await getLocale();
  const article = await localizeRecord(
    "News",
    loaded,
    ["title", "excerpt", "content", "keyTakeaway"],
    locale,
  );

  const relatedRows = await loadRelated(article.slug, article.category);
  const related = await localizeRecords(
    "News",
    relatedRows,
    ["title", "excerpt"],
    locale,
  );

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
    // Image unique = illustration (hero) ; repli sur l'image héritée (legacy).
    image: article.heroIllustration ?? article.image ?? undefined,
    heroIllustration: article.heroIllustration ?? undefined,
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
    image: a.heroIllustration ?? a.image ?? undefined,
  }));

  return (
    <ArticleView
      article={newsItem}
      related={relatedItems}
      articleHeroIllustration={newsItem.heroIllustration}
      isAdmin={user?.isAdmin === true}
      accent="#7C3AED"
    />
  );
}
