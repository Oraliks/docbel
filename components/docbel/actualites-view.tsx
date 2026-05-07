"use client";

import { useRouter } from "next/navigation";
import { ActualitesPage } from "@/components/docbel/actualites-page";
import type { NewsItem } from "@/lib/docbel-data";

export function ActualitesView({ initialArticles }: { initialArticles: NewsItem[] }) {
  const router = useRouter();
  return (
    <ActualitesPage
      initialArticles={initialArticles}
      onArticleClick={(article) => router.push(`/actualites/${article.slug ?? article.id}`)}
    />
  );
}
