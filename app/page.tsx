"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/docbel/hero";
import { ToolsSection } from "@/components/docbel/tools";
import { LoadingView } from "@/components/docbel/loading-view";
import { TOOLS_DATA, Tool, NewsItem, getToolSlug } from "@/lib/docbel-data";
import { useAppState } from "@/lib/app-state-context";

export default function Home() {
  const router = useRouter();
  const { toolsCat, setToolsCat } = useAppState();
  const [newsIdx, setNewsIdx] = useState(0);
  const [apiNews, setApiNews] = useState<NewsItem[]>([]);
  const [toolsSearch, setToolsSearch] = useState("");
  const [toolsLayout, setToolsLayout] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingTool, setLoadingTool] = useState<Tool | null>(null);

  const accent = "#C8102E";

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news?status=published&featured=true");
        if (response.ok) {
          const data = await response.json();
          const mappedNews = (data.articles || [])
            .filter((article: { featured: boolean }) => article.featured === true)
            .map((article: { id: string; category: string; title: string; excerpt: string; publishedAt: string; color: string; readingTime: number; featured: boolean; image: string | null }) => ({
              id: article.id,
              tag: article.category,
              title: article.title,
              desc: article.excerpt,
              date: new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
              color: article.color,
              readingTime: article.readingTime,
              popular: article.featured,
              image: article.image,
            }));
          setApiNews(mappedNews);
        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };
    fetchNews();
  }, []);

  const newsToUse = apiNews;

  useEffect(() => {
    const t = setInterval(() => setNewsIdx((i) => (i + 1) % newsToUse.length), 8000);
    return () => clearInterval(t);
  }, [newsToUse.length]);

  const filteredTools = TOOLS_DATA.filter((t) => {
    const matchCat = toolsCat === "Tous" || t.cat === toolsCat;
    const matchSearch =
      t.title.toLowerCase().includes(toolsSearch.toLowerCase()) ||
      t.desc.toLowerCase().includes(toolsSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const heroTools = TOOLS_DATA.filter((t) => t.id === 6 || t.id === 2);

  const handleToolClick = (tool: Tool) => {
    setIsLoading(true);
    setLoadingTool(tool);
    setTimeout(() => {
      router.push(`/outils/${getToolSlug(tool)}`);
    }, 900);
  };

  const handleArticleClick = (article: NewsItem) => {
    router.push(`/actualites/${article.id}`);
  };

  if (isLoading) {
    return (
      <div style={{ padding: "32px 36px 40px" }}>
        <LoadingView accent={accent} tool={loadingTool} />
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px 40px", flex: 1, overflowY: "auto" }}>
      <HeroSection
        news={newsToUse}
        newsIdx={newsIdx}
        setNewsIdx={setNewsIdx}
        accent={accent}
        heroStyle="gradient"
        onArticleClick={handleArticleClick}
        featuredTools={heroTools}
        onToolClick={handleToolClick}
      />
      <ToolsSection
        tools={filteredTools}
        search={toolsSearch}
        setSearch={setToolsSearch}
        cat={toolsCat}
        setCat={setToolsCat}
        layout={toolsLayout}
        setLayout={setToolsLayout}
        accent={accent}
        setOpenTool={handleToolClick}
      />
    </div>
  );
}
