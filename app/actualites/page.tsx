"use client";

import { useRouter } from "next/navigation";
import { ActualitesPage } from "@/components/docbel/actualites-page";
import { NewsItem } from "@/lib/docbel-data";

export default function ActualitesRoute() {
  const router = useRouter();

  const handleArticleClick = (article: NewsItem) => {
    router.push(`/actualites/${article.id}`);
  };

  return <ActualitesPage onArticleClick={handleArticleClick} />;
}
