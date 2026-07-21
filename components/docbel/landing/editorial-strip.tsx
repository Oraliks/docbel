import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { NewsItem } from "@/lib/docbel-data";
import { cn } from "@/lib/utils";

interface LandingEditorialStripProps {
  articles: NewsItem[];
}

/** Etage editorial secondaire : trois articles, sans concurrencer le guichet. */
export async function LandingEditorialStrip({
  articles,
}: LandingEditorialStripProps) {
  if (articles.length === 0) return null;

  const t = await getTranslations("public.home");
  const visible = articles.slice(0, 3);

  return (
    <section
      aria-labelledby="landing-editorial-heading"
      className="glass-surface p-4 sm:p-6 lg:p-7"
    >
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="size-6 shrink-0 text-primary" aria-hidden />
          <h2
            id="landing-editorial-heading"
            className="glass-display text-[27px] font-semibold leading-tight sm:text-[32px]"
          >
            {t("recentNewsTitle")}
          </h2>
        </div>
        <Link
          href="/actualites"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 w-fit")}
        >
          {t("seeAll")}
          <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
        </Link>
      </header>

      <ul className="flex flex-col lg:flex-row">
        {visible.map((article, index) => (
          <li key={article.id} className="flex min-w-0 flex-1 flex-col lg:flex-row">
            <Link
              href={article.slug ? `/actualites/${article.slug}` : "/actualites"}
              className="glass-interactive group flex min-h-32 flex-1 items-start gap-3 rounded-xl px-2 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{article.tag}</Badge>
                  {article.popular ? <Badge variant="outline">{t("toolPopularBadge")}</Badge> : null}
                </span>
                <span className="mt-3 line-clamp-2 block text-base font-semibold leading-snug text-foreground">
                  {article.title}
                </span>
                <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                  {article.desc}
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{article.date}</span>
                  {article.readingTime ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" aria-hidden />
                      {t("readingTime", { minutes: article.readingTime })}
                    </span>
                  ) : null}
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
            </Link>
            {index < visible.length - 1 ? (
              <>
                <Separator className="lg:hidden" />
                <Separator orientation="vertical" className="hidden lg:block" />
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
