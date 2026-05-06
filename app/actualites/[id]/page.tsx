"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, NewspaperIcon } from "lucide-react";
import { ArticlePage } from "@/components/docbel/article-page";
import { NewsItem } from "@/lib/docbel-data";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function ArticleRoute() {
  const router = useRouter();
  const params = useParams();
  const [article, setArticle] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  const articleId = params.id as string;

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/news/${articleId}`);
        if (!response.ok) {
          setArticle(null);
          return;
        }

        const data = await response.json();
        setArticle({
          id: data.id,
          tag: data.category,
          title: data.title,
          desc: data.excerpt,
          date: new Date(data.publishedAt || data.createdAt).toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          color: data.color || "#C8102E",
          readingTime: data.readingTime,
          popular: data.featured,
          image: data.image || undefined,
          content: data.content,
        });
      } catch (error) {
        console.error("Error fetching article:", error);
        setArticle(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchArticle();
  }, [articleId]);

  if (loading) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NewspaperIcon />
          </EmptyMedia>
          <EmptyTitle>Chargement de l&apos;article...</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!article) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <NewspaperIcon />
          </EmptyMedia>
          <EmptyTitle>Article non trouve</EmptyTitle>
          <EmptyDescription>
            L&apos;article demande n&apos;est pas disponible ou n&apos;existe plus.
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => router.push("/actualites")}>
          <ArrowLeftIcon data-icon="inline-start" />
          Retour aux actualites
        </Button>
      </Empty>
    );
  }

  return <ArticlePage article={article} accent="#C8102E" onBack={() => router.push("/actualites")} />;
}
