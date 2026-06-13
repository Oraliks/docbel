import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleView } from "@/components/docbel/employeur/library/article-view";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getSourceMap } from "@/lib/employeur/queries";
import { getArticle } from "@/lib/employeur/library/articles";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) {
    return { title: "Article introuvable | Espace Employeur" };
  }
  return {
    title: `${article.title} | Bibliothèque Employeur`,
    description: article.summary,
  };
}

export default async function BibliothequeArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const sources = await getSourceMap();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <Button variant="ghost" size="sm" render={<Link href="/employeur/bibliotheque" />}>
        <ArrowLeft /> Bibliothèque
      </Button>
      <ArticleView article={article} sources={sources} />
    </div>
  );
}
