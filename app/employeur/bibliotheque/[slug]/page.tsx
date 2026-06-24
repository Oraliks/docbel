import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleView } from "@/components/docbel/employeur/library/article-view";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getSourceMap } from "@/lib/employeur/queries";
import { getArticle, getLocalizedArticle } from "@/lib/employeur/library/articles";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return { title: t("libArticleMetaNotFound") };
  }
  const localized = await getLocalizedArticle(article);
  return {
    title: t("libArticleMetaTitle", { title: localized.title }),
    description: localized.summary,
  };
}

export default async function BibliothequeArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const [sources, localizedArticle] = await Promise.all([
    getSourceMap(),
    getLocalizedArticle(article),
  ]);

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur/bibliotheque" />}>
        <ArrowLeft /> {t("backToLibrary")}
      </Button>
      <ArticleView article={localizedArticle} sources={sources} />
    </div>
  );
}
