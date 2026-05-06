"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NewsItem, Tool } from "@/lib/docbel-data";
import {
  ArrowRightIcon,
  CalculatorIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  PauseIcon,
} from "lucide-react";

interface HeroSectionProps {
  news: NewsItem[];
  newsIdx: number;
  setNewsIdx: (index: number | ((prev: number) => number)) => void;
  accent: string;
  heroStyle: "gradient" | "flat" | "bordered";
  onArticleClick?: (news: NewsItem) => void;
  featuredTools?: Tool[];
  onToolClick?: (tool: Tool) => void;
}

function getToolVisual(tool: Tool) {
  if (tool.title.toLowerCase().includes("pr") || tool.title.toLowerCase().includes("c4")) {
    return {
      icon: FileTextIcon,
      tileClassName:
        "bg-linear-to-br from-violet-100 via-fuchsia-50 to-white text-violet-500 dark:from-violet-500/20 dark:via-violet-400/10 dark:to-transparent dark:text-violet-200",
    };
  }

  if (tool.title.toLowerCase().includes("chômage") || tool.title.toLowerCase().includes("chomage")) {
    return {
      icon: PauseIcon,
      tileClassName:
        "bg-linear-to-br from-sky-100 via-cyan-50 to-white text-sky-500 dark:from-sky-500/20 dark:via-sky-400/10 dark:to-transparent dark:text-sky-200",
    };
  }

  return {
    icon: CalculatorIcon,
    tileClassName:
      "bg-linear-to-br from-emerald-100 via-lime-50 to-white text-emerald-500 dark:from-emerald-500/20 dark:via-emerald-400/10 dark:to-transparent dark:text-emerald-200",
  };
}

function HeroDocumentVisual() {
  return (
    <div className="relative flex min-h-[120px] items-center justify-center overflow-hidden lg:min-h-[132px]">
      <div className="absolute inset-y-3 right-2 aspect-square rounded-full bg-linear-to-br from-violet-300/30 via-fuchsia-200/25 to-transparent blur-3xl" />
      <div className="absolute left-1/2 top-4 h-24 w-24 -translate-x-1/2 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-400/15" />
      <div className="relative rotate-6 rounded-[1.35rem] bg-white/85 p-3 shadow-[0_30px_60px_-30px_rgba(126,87,194,0.45)] ring-1 ring-white/80 backdrop-blur dark:bg-white/10 dark:ring-white/10">
        <div className="absolute -left-4 top-4 h-[88%] w-full rounded-[2rem] bg-violet-200/25 blur-md dark:bg-violet-400/10" />
        <div className="relative flex w-[102px] flex-col gap-2 rounded-[1.05rem] bg-white/90 p-3 dark:bg-background/80 lg:w-[108px]">
          <div className="flex items-center justify-between">
            <span className="h-2 w-7 rounded-full bg-violet-300/90 dark:bg-violet-300/70" />
            <div className="flex size-7 items-center justify-center rounded-xl bg-violet-100 text-violet-500 dark:bg-violet-400/15 dark:text-violet-200">
              <FileTextIcon className="size-4" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-violet-200/90 dark:bg-violet-300/20" />
            <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-300/15" />
            <div className="h-1.5 w-4/5 rounded-full bg-violet-100 dark:bg-violet-300/15" />
          </div>
          <div className="space-y-2">
            <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-300/15" />
            <div className="h-1.5 w-3/4 rounded-full bg-violet-100 dark:bg-violet-300/15" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection({
  news,
  newsIdx,
  setNewsIdx,
  onArticleClick,
  featuredTools = [],
  onToolClick,
}: HeroSectionProps) {
  if (!news.length) {
    return null;
  }

  const article = news[newsIdx];

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Editorial</p>
          <h2 className="text-2xl font-semibold tracking-tight lg:text-[2rem]">Actualités</h2>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            onClick={() => setNewsIdx((value) => (value - 1 + news.length) % news.length)}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Article précédent</span>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            onClick={() => setNewsIdx((value) => (value + 1) % news.length)}
          >
            <ChevronRightIcon />
            <span className="sr-only">Article suivant</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <Card
          role="button"
          tabIndex={0}
          className="overflow-hidden rounded-[28px] border-white/70 bg-linear-to-br from-white via-violet-50/65 to-white shadow-[0_24px_80px_-48px_rgba(21,20,46,0.35)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10 dark:from-card dark:via-violet-500/5 dark:to-card"
          onClick={() => onArticleClick?.(article)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onArticleClick?.(article);
            }
          }}
        >
          <CardContent className="grid gap-2 p-3.5 lg:min-h-[132px] lg:grid-cols-[minmax(0,1fr)_104px] lg:items-center lg:p-4">
            <div className="flex h-full flex-col">
              <Badge
                className="w-fit rounded-full border-0 px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]"
                style={{
                  backgroundColor: article.color ? `${article.color}18` : undefined,
                  color: article.color || undefined,
                }}
              >
                {article.tag}
              </Badge>

              <div className="mt-2.5 space-y-1.5">
                <h3 className="max-w-[26rem] text-lg font-semibold leading-tight tracking-tight text-balance lg:text-[1.45rem]">
                  {article.title}
                </h3>
                <p className="max-w-[26rem] text-[13px] leading-5 text-muted-foreground line-clamp-2">
                  {article.desc}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[13px]">
                <span className="text-muted-foreground">{article.date}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 font-semibold text-violet-600 transition-colors hover:text-violet-500 dark:text-violet-300"
                >
                  Lire l&apos;article complet
                  <ArrowRightIcon className="size-4" />
                </button>
              </div>
            </div>

            <div className="hidden lg:block">
              <HeroDocumentVisual />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-2.5">
          {featuredTools.slice(0, 2).map((tool) => {
            const visual = getToolVisual(tool);
            const Icon = visual.icon;

            return (
              <Card
                key={tool.id}
                role="button"
                tabIndex={0}
                className="rounded-[26px] border-white/70 bg-white/90 shadow-[0_20px_70px_-52px_rgba(21,20,46,0.28)] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10 dark:bg-card"
                onClick={() => onToolClick?.(tool)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToolClick?.(tool);
                  }
                }}
              >
                <CardContent className="flex h-full items-center justify-between gap-3 p-3 lg:p-3.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Badge
                      variant="secondary"
                      className="mb-1.5 w-fit rounded-full border-0 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.14em]"
                    >
                      {tool.popular ? "Info pratique" : "Mise à jour"}
                    </Badge>
                    <h3 className="text-[15px] font-semibold leading-tight text-balance lg:text-base">
                      {tool.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                      {tool.desc}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[13px]">
                      <span className="text-muted-foreground">{tool.time}</span>
                      <span className="inline-flex items-center gap-2 font-semibold text-primary">
                        Lire la suite
                        <ArrowRightIcon className="size-4" />
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl shadow-inner lg:size-11 ${visual.tileClassName}`}
                  >
                    <Icon className="size-5 lg:size-5.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {news.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setNewsIdx(index)}
            className="inline-flex h-4 items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all duration-200 ${
                index === newsIdx
                  ? "h-2.5 w-6 bg-violet-500 dark:bg-violet-300"
                  : "size-2 bg-muted-foreground/25"
              }`}
            />
            <span className="sr-only">Afficher l&apos;article {index + 1}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
