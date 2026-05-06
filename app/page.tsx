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

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch("/api/news?status=published&featured=true");
        if (!response.ok) return;

        const data = await response.json();
        const mappedNews = (data.articles || [])
          .filter((article: { featured: boolean }) => article.featured === true)
          .map(
            (article: {
              id: string;
              category: string;
              title: string;
              excerpt: string;
              publishedAt: string;
              color: string;
              readingTime: number;
              featured: boolean;
              image: string | null;
            }) => ({
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
              image: article.image || undefined,
            })
          );

        setApiNews(mappedNews);
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };

    void fetchNews();
  }, []);

  useEffect(() => {
    if (!apiNews.length) return;

    const timer = setInterval(() => {
      setNewsIdx((value) => (value + 1) % apiNews.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [apiNews.length]);

  const filteredTools = TOOLS_DATA.filter((tool) => {
    const matchesCategory = toolsCat === "Tous" || tool.cat === toolsCat;
    const matchesSearch =
      tool.title.toLowerCase().includes(toolsSearch.toLowerCase()) ||
      tool.desc.toLowerCase().includes(toolsSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredTools = TOOLS_DATA.filter((tool) => tool.id === 6 || tool.id === 2);

  const handleToolClick = (tool: Tool) => {
    setIsLoading(true);
    setLoadingTool(tool);

    window.setTimeout(() => {
      router.push(`/outils/${getToolSlug(tool)}`);
    }, 900);
  };

  const handleArticleClick = (article: NewsItem) => {
    router.push(`/actualites/${article.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <LoadingView accent="#C8102E" tool={loadingTool} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <HeroSection
        news={apiNews}
        newsIdx={newsIdx}
        setNewsIdx={setNewsIdx}
        accent="#C8102E"
        heroStyle="gradient"
        onArticleClick={handleArticleClick}
        featuredTools={featuredTools}
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
        accent="#C8102E"
        setOpenTool={handleToolClick}
      />
    </div>
  );
}
