"use client";

import { ArrowLeftIcon, NewspaperIcon, Share2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { NewsItem } from "@/lib/docbel-data";

interface ArticlePageProps {
  article: NewsItem;
  accent: string;
  onBack: () => void;
}

export function ArticlePage({ article, onBack }: ArticlePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Retour aux actualites
        </Button>
        <Badge variant="secondary">{article.tag}</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{article.date}</span>
            {article.readingTime ? (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>{article.readingTime} min de lecture</span>
              </>
            ) : null}
          </div>
          <CardTitle className="text-4xl leading-tight">{article.title}</CardTitle>
          <CardDescription className="text-base">{article.desc}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-xl border bg-muted">
            {article.image ? (
              // Article hero media comes from editor-provided content and intentionally bypasses next/image remote rules.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={article.image} alt={article.title} className="max-h-[420px] w-full object-cover" />
            ) : (
              <div className="flex h-72 items-center justify-center">
                <NewspaperIcon className="size-12 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card px-6 py-6">
            {article.content && article.content.length > 0 ? (
              article.content.includes("<") ? (
                <div
                  dangerouslySetInnerHTML={{ __html: article.content }}
                  className="article-content text-foreground"
                />
              ) : (
                article.content.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="mb-4 text-foreground last:mb-0">
                    {paragraph}
                  </p>
                ))
              )
            ) : (
              <p className="text-muted-foreground">
                Le contenu detaille de cet article n&apos;est pas disponible.
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Besoin d&apos;un accompagnement complementaire sur cette information ?
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onBack}>
              Retour
            </Button>
            <Button>
              <Share2Icon data-icon="inline-start" />
              Partager
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
