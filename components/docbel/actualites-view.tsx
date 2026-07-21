"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NewsItem } from "@/lib/docbel-data";
import { AcronymText } from "@/components/docbel/acronym";
import { SmartImage } from "@/components/ui/smart-image";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL_TAG = "Tous";

export function ActualitesView({
  initialArticles,
  initialCategory,
}: {
  initialArticles: NewsItem[];
  initialCategory?: string;
}) {
  const t = useTranslations("public.contenu");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string>(() => {
    if (!initialCategory) return ALL_TAG;
    const matchingArticle = initialArticles.find(
      (article) =>
        article.tag?.toLowerCase() === initialCategory.toLowerCase(),
    );
    return matchingArticle?.tag ?? ALL_TAG;
  });

  const tags = useMemo(() => {
    const uniqueTags = new Set<string>();
    initialArticles.forEach((article) => {
      if (article.tag) uniqueTags.add(article.tag);
    });
    return [ALL_TAG, ...Array.from(uniqueTags).sort()];
  }, [initialArticles]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return initialArticles.filter((article) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        article.title.toLocaleLowerCase().includes(normalizedSearch) ||
        article.desc.toLocaleLowerCase().includes(normalizedSearch) ||
        article.tag.toLocaleLowerCase().includes(normalizedSearch);
      const matchesTag = activeTag === ALL_TAG || article.tag === activeTag;
      return matchesSearch && matchesTag;
    });
  }, [activeTag, initialArticles, search]);

  const featured = filtered.find((article) => article.popular) ?? filtered[0];
  const rest = filtered.filter((article) => article.id !== featured?.id);

  const selectTag = (tag: string) => {
    setActiveTag(tag);
    router.replace(
      tag === ALL_TAG
        ? "/actualites"
        : `/actualites?cat=${encodeURIComponent(tag)}`,
      { scroll: false },
    );
  };

  return (
    <section className="flex w-full flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-3 px-1 sm:px-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("pressEyebrow")}
        </p>
        <h1 className="glass-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
          {t("pressTitle")} <em>{t("pressTitleEm")}</em>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
          {t("pressIntro")}
        </p>
      </header>

      <div className="flex flex-col gap-3 px-1 sm:px-2 lg:flex-row lg:items-start">
        <InputGroup className="h-11 rounded-2xl lg:max-w-md">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={t("searchPlaceholder")}
            placeholder={t("searchPlaceholder")}
          />
        </InputGroup>

        <ToggleGroup
          value={[activeTag]}
          onValueChange={(value) => {
            const selectedTag = value[0];
            if (selectedTag) selectTag(selectedTag);
          }}
          variant="outline"
          size="sm"
          spacing={2}
          aria-label={t("allArticlesTitle")}
          className="w-full flex-wrap justify-start lg:justify-end"
        >
          {tags.map((tag) => (
            <ToggleGroupItem
              key={tag}
              value={tag}
              className="min-h-9 rounded-full px-3.5"
            >
              {tag === ALL_TAG ? t("filterAll") : tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <Empty className="glass-surface min-h-64 border border-[color:var(--glass-border)]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6 sm:gap-8">
          {featured ? (
            <Link
              href={`/actualites/${featured.slug ?? featured.id}`}
              className="group rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--glass-bg-a)]"
            >
              <Card className="gap-0 rounded-3xl py-0 transition-colors group-hover:ring-[color:var(--glass-accent-deep)]">
                <div className="grid min-h-80 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
                  <div className="flex flex-col py-3 sm:py-5">
                    <CardHeader className="gap-3 px-5 sm:px-7">
                      <Badge variant="default">
                        {t("featuredBadge", { tag: featured.tag })}
                      </Badge>
                      <CardTitle>
                        <h2 className="glass-display text-3xl font-semibold leading-tight sm:text-4xl">
                          <AcronymText>{featured.title}</AcronymText>
                        </h2>
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        <AcronymText>{featured.desc}</AcronymText>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-5 text-xs text-[color:var(--glass-ink-faint)] sm:px-7">
                      {featured.date ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarIcon className="size-3.5" aria-hidden />
                          {featured.date}
                        </span>
                      ) : null}
                      {featured.readingTime ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="size-3.5" aria-hidden />
                          {t("readingTimeMin", { min: featured.readingTime })}
                        </span>
                      ) : null}
                    </CardContent>
                    <CardFooter className="mt-5 gap-2 border-0 bg-transparent px-5 py-0 font-semibold text-[color:var(--glass-ink)] sm:px-7">
                      {t("readArticle")}
                      <ArrowRightIcon className="size-4" aria-hidden />
                    </CardFooter>
                  </div>

                  <div
                    className="relative min-h-56 overflow-hidden lg:min-h-full"
                    style={{
                      backgroundImage:
                        "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
                    }}
                  >
                    <SmartImage
                      src={featured.image}
                      alt=""
                      fallbackMode="hide"
                      className="absolute inset-0 size-full"
                      imgClassName="opacity-90"
                    />
                  </div>
                </div>
              </Card>
            </Link>
          ) : null}

          {rest.length > 0 ? (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2 px-1 sm:px-2">
                <h2 className="glass-display text-2xl font-semibold">
                  {t("allArticlesTitle")}
                </h2>
                <p className="text-xs text-[color:var(--glass-ink-soft)]">
                  {t("feedCount", { count: filtered.length })}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((article) => (
                  <Link
                    key={article.id}
                    href={`/actualites/${article.slug ?? article.id}`}
                    className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--glass-bg-a)]"
                  >
                    <Card className="h-full transition-colors group-hover:ring-[color:var(--glass-accent-deep)]">
                      <CardHeader className="gap-2">
                        <Badge variant="secondary">{article.tag}</Badge>
                        <CardTitle>
                          <h3 className="text-base font-bold leading-snug">
                            <AcronymText>{article.title}</AcronymText>
                          </h3>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <CardDescription className="line-clamp-3 leading-relaxed">
                          <AcronymText>{article.desc}</AcronymText>
                        </CardDescription>
                      </CardContent>
                      <CardFooter className="flex-wrap justify-between gap-2 text-xs text-[color:var(--glass-ink-faint)]">
                        {article.date ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarIcon className="size-3.5" aria-hidden />
                            {article.date}
                          </span>
                        ) : null}
                        {article.readingTime ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon className="size-3.5" aria-hidden />
                            {t("readingMinShort", { min: article.readingTime })}
                          </span>
                        ) : null}
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
