"use client";

import { useRouter, useParams } from "next/navigation";
import { ArticlePage } from "@/components/docbel/article-page";
import { NewsItem } from "@/lib/docbel-data";
import { useState, useEffect } from "react";

export default function ArticleRoute() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  const accent = "#C8102E";

  const articleId = params.id as string;

  useEffect(() => {
    const fetchArticle = async () => {
      // Fetch from the database API
      try {
        const response = await fetch(`/api/news/${articleId}`);
        if (response.ok) {
          const data = await response.json();
          const mappedArticle: NewsItem = {
            id: data.id,
            tag: data.category,
            title: data.title,
            desc: data.excerpt,
            date: new Date(data.publishedAt || data.createdAt).toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "short",
              day: "numeric"
            }),
            color: data.color || "#C8102E",
            readingTime: data.readingTime,
            popular: data.featured,
            image: data.image,
            content: data.content,
          };
          setArticle(mappedArticle);
        } else {
          setArticle(null);
        }
      } catch (error) {
        console.error("Error fetching article:", error);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!article) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1 className="text-foreground">Article non trouvé</h1>
        <button
          onClick={() => router.push("/actualites")}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: accent,
            color: "white",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Retour aux actualités
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ArticlePage article={article} accent={accent} onBack={() => router.push("/actualites")} />
    </div>
  );
}
