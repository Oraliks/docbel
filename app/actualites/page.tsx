"use client";

import { useRouter } from "next/navigation";
import { ActualitesPage } from "@/components/docbel/actualites-page";

export default function ActualitesRoute() {
  const router = useRouter();

  const accent = "#C8102E";

  const handleArticleClick = (article: any) => {
    router.push(`/actualites/${article.id}`);
  };

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ActualitesPage onArticleClick={handleArticleClick} />
    </div>
  );
}
