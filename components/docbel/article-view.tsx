"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ArrowLeftIcon, CalendarIcon, ClockIcon } from "lucide-react";
import type { NewsItem } from "@/lib/docbel-data";
import { enrichHtmlWithAcronyms } from "@/lib/acronyms-html";
import { AcronymText } from "@/components/docbel/acronym";

interface ArticleViewProps {
  article: NewsItem;
  // Kept for API compatibility with the route. Unused — glass tokens drive
  // the accent now.
  accent?: string;
}

export function ArticleView({ article }: ArticleViewProps) {
  const router = useRouter();
  // Enrichit l'HTML rich-text avec les <abbr> du glossaire. Mémoïsé
  // pour ne pas re-tokeniser à chaque re-render (le contenu d'un
  // article ne change pas pendant la vie de la page).
  const enrichedContent = useMemo(
    () => (article.content ? enrichHtmlWithAcronyms(article.content) : ""),
    [article.content],
  );

  return (
    <article className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/actualites")}
        className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition-colors outline-none hover:bg-white/55 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
      >
        <ArrowLeftIcon className="size-4" />
        Toutes les actualités
      </button>

      <header className="glass-surface flex flex-col gap-5 p-8 sm:p-10">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: "var(--glass-accent-c)" }}
          />
          {article.tag}
        </span>

        <h1 className="glass-display max-w-3xl text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          <AcronymText>{article.title}</AcronymText>
        </h1>

        <p className="max-w-3xl text-[15px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
          <AcronymText>{article.desc}</AcronymText>
        </p>

        <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-[color:var(--glass-ink-faint)]">
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5" />
            {article.date}
          </span>
          {article.readingTime ? (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-3.5" />
              {article.readingTime} min de lecture
            </span>
          ) : null}
        </div>

        {article.image ? (
          <div className="relative mt-2 overflow-hidden rounded-[20px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        ) : null}
      </header>

      {article.content ? (
        <div className="glass-surface p-8 sm:p-10">
          <div
            className="prose prose-neutral max-w-3xl text-[15.5px] leading-[1.7] [&_a]:font-semibold [&_a]:text-[color:var(--glass-accent-deep)] [&_h2]:glass-display [&_h2]:mt-8 [&_h2]:text-[26px] [&_h2]:font-semibold [&_h3]:glass-display [&_h3]:mt-6 [&_h3]:text-[20px] [&_h3]:font-semibold [&_p]:mt-4 [&_strong]:text-[color:var(--glass-ink)] dark:prose-invert"
            style={{ color: "var(--glass-ink)" }}
            dangerouslySetInnerHTML={{ __html: enrichedContent }}
          />
        </div>
      ) : (
        <div className="glass-surface px-6 py-16 text-center">
          <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
            Le contenu de cet article n&apos;est pas encore disponible.
          </p>
        </div>
      )}
    </article>
  );
}
