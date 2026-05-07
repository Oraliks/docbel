"use client";

import { useRouter } from "next/navigation";
import { ArticlePage } from "@/components/docbel/article-page";
import type { NewsItem } from "@/lib/docbel-data";

export function ArticleView({ article, accent }: { article: NewsItem; accent: string }) {
  const router = useRouter();
  return <ArticlePage article={article} accent={accent} onBack={() => router.push("/actualites")} />;
}
