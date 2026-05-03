"use client";

import { useRouter } from "next/navigation";
import { ActualitesPage } from "@/components/docbel/actualites-page";
import { NewsItem } from "@/lib/docbel-data";

export default function ActualitesRoute() {
  const router = useRouter();

  const handleArticleClick = (article: NewsItem) => {
    router.push(`/actualites/${article.id}`);
  };

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ActualitesPage onArticleClick={handleArticleClick} />
    </div>
  );
}
