import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock3, Newspaper } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { NewsItem } from "@/lib/docbel-data";
import { cn } from "@/lib/utils";

interface LandingEditorialStripProps {
  articles: NewsItem[];
}

/** Trois articles publies, dans l'ordre fourni par la requete serveur bornee. */
export async function LandingEditorialStrip({
  articles,
}: LandingEditorialStripProps) {
  if (articles.length === 0) return null;

  const t = await getTranslations("public.home");
  const visible = articles.slice(0, 3);

  return (
    <Card
      aria-labelledby="landing-editorial-heading"
      className="h-full rounded-[24px] py-5 sm:py-6"
    >
      <CardHeader className="gap-2 px-5 sm:px-6">
        <CardTitle>
          <h2
            id="landing-editorial-heading"
            className="glass-display text-[25px] font-semibold leading-tight sm:text-[29px]"
          >
            {t("recentNewsTitle")}
          </h2>
        </CardTitle>
        <CardAction>
          <Link
            href="/actualites"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0 text-primary",
            )}
          >
            <span className="sr-only sm:not-sr-only sm:inline">{t("seeAll")}</span>
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-5 sm:px-6">
        <ul className="flex flex-1 flex-col">
          {visible.map((article, index) => (
            <li key={article.id} className="flex flex-col">
              <Link
                href={article.slug ? `/actualites/${article.slug}` : "/actualites"}
                className="glass-interactive group grid min-h-[132px] grid-cols-[116px_minmax(0,1fr)] gap-3 rounded-2xl p-2 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                <span
                  className="relative min-h-24 overflow-hidden rounded-xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(145deg, color-mix(in oklab, var(--glass-accent-c) 42%, transparent), color-mix(in oklab, var(--glass-accent-a) 52%, transparent))",
                  }}
                >
                  {article.image ? (
                    <SmartImage
                      src={article.image}
                      alt=""
                      fallbackMode="hide"
                      className="absolute inset-0 size-full"
                      imgClassName="object-cover"
                    />
                  ) : (
                    <Newspaper className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-primary" aria-hidden />
                  )}
                </span>

                <span className="flex min-w-0 flex-col py-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="max-w-full truncate">
                      {article.tag}
                    </Badge>
                    {article.popular ? (
                      <Badge variant="outline">{t("toolPopularBadge")}</Badge>
                    ) : null}
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-[color:var(--glass-ink)]">
                    {article.title}
                  </span>
                  <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-[11px] text-[color:var(--glass-ink-faint)]">
                    <span>{article.date}</span>
                    {article.readingTime ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" aria-hidden />
                        {t("readingTime", { minutes: article.readingTime })}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
              {index < visible.length - 1 ? <Separator className="my-1" /> : null}
            </li>
          ))}
        </ul>

        <Link
          href="/actualites"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-4 w-full",
          )}
        >
          {t("seeAll")}
          <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
