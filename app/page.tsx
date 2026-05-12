"use client";

import { useEffect, useMemo, useState } from "react";
import { LandingBottom } from "@/components/docbel/landing/bottom";
import { LandingHero } from "@/components/docbel/landing/hero";
import { LandingTools } from "@/components/docbel/landing/tools";
import { type AudienceId, getAudienceFromPath } from "@/lib/audience";
import {
  type NewsItem,
  TOOLS_DATA,
  getToolsByAudience,
} from "@/lib/docbel-data";

const MONTH_LABELS = [
  "JAN",
  "FÉV",
  "MARS",
  "AVR",
  "MAI",
  "JUIN",
  "JUIL",
  "AOÛT",
  "SEPT",
  "OCT",
  "NOV",
  "DÉC",
];

function formatFrenchDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")} ${
    MONTH_LABELS[parsed.getMonth()]
  } ${String(parsed.getFullYear()).slice(2)}`;
}

export default function HomePage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // The header (with persona switcher) lives in AppLayoutClient; this page
  // just decides which tools to show based on the URL.
  const persona: AudienceId = getAudienceFromPath("/");

  useEffect(() => {
    let cancelled = false;
    async function fetchNews() {
      try {
        const res = await fetch("/api/news?status=published&featured=true");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const mapped: NewsItem[] = (data.articles || []).map((article: {
          id: string;
          slug: string;
          category: string;
          title: string;
          excerpt: string;
          publishedAt: string;
          color: string;
          readingTime: number;
          featured: boolean;
          image?: string | null;
        }) => ({
          id: article.id,
          slug: article.slug,
          tag: article.category,
          title: article.title,
          desc: article.excerpt,
          date: formatFrenchDate(article.publishedAt),
          color: article.color,
          readingTime: article.readingTime,
          popular: article.featured,
          image: article.image || undefined,
        }));
        setNews(mapped);
      } catch (error) {
        console.error("Home — fetch news failed:", error);
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    }
    void fetchNews();
    return () => {
      cancelled = true;
    };
  }, []);

  const tools = useMemo(() => {
    const audienceTools = getToolsByAudience(persona);
    return audienceTools.length ? audienceTools : TOOLS_DATA;
  }, [persona]);

  const featuredArticle = news[0] ?? null;

  return (
    <>
      <LandingHero article={featuredArticle} loading={newsLoading} />
      <LandingTools tools={tools} />
      <LandingBottom news={news} loading={newsLoading} />
    </>
  );
}
