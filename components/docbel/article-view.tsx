"use client";

import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  FileTextIcon,
  PencilIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { NewsItem } from "@/lib/docbel-data";
import { enrichHtmlWithAcronyms } from "@/lib/acronyms-html";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { AcronymText } from "@/components/docbel/acronym";
import { ShareMenu } from "./share-menu";
import { SmartImage } from "@/components/ui/smart-image";
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

interface ArticleViewProps {
  article: NewsItem;
  related?: NewsItem[];
  articleHeroIllustration?: string;
  isAdmin?: boolean;
}

const BOOKMARK_PREFIX = "docbel:bookmark:";
const BOOKMARK_EVENT = "docbel:bookmark-change";
const CONTENT_ANCHOR = "article-content";

function getServerBookmarkSnapshot() {
  return false;
}

function CategoryBadge({ children }: { children: React.ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}

export function ArticleView({
  article,
  related = [],
  articleHeroIllustration,
  isAdmin = false,
}: ArticleViewProps) {
  const t = useTranslations("public.article");
  const enrichedContent = useMemo(
    () =>
      article.content
        ? enrichHtmlWithAcronyms(sanitizeHtml(article.content))
        : "",
    [article.content],
  );

  const bookmarkKey = `${BOOKMARK_PREFIX}${article.slug ?? article.id}`;
  const subscribeBookmark = useCallback(
    (onStoreChange: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === bookmarkKey) onStoreChange();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(BOOKMARK_EVENT, onStoreChange);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(BOOKMARK_EVENT, onStoreChange);
      };
    },
    [bookmarkKey],
  );
  const getBookmarkSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(bookmarkKey) === "1";
    } catch {
      return false;
    }
  }, [bookmarkKey]);
  const saved = useSyncExternalStore(
    subscribeBookmark,
    getBookmarkSnapshot,
    getServerBookmarkSnapshot,
  );

  const toggleSaved = useCallback(() => {
    const nextSaved = !saved;
    try {
      if (nextSaved) {
        window.localStorage.setItem(bookmarkKey, "1");
      } else {
        window.localStorage.removeItem(bookmarkKey);
      }
      window.dispatchEvent(new Event(BOOKMARK_EVENT));
    } catch {
      // L'article reste lisible si le stockage navigateur est indisponible.
    }
    toast.success(nextSaved ? t("articleSaved") : t("articleUnsaved"));
  }, [bookmarkKey, saved, t]);

  const scrollToContent = useCallback(() => {
    const reducedMotion =
      document.documentElement.dataset.docbelMotion === "reduced" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(CONTENT_ANCHOR)?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const hasSummary = Boolean(article.summary?.length);
  const hasDocs = Boolean(article.linkedDocs?.length);
  const hasFaqs = Boolean(article.faqs?.length);
  const hasRightRail = hasSummary || hasDocs || hasFaqs;

  return (
    <div className="flex w-full flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <Button
          render={<Link href="/actualites" />}
          nativeButton={false}
          variant="ghost"
          size="sm"
        >
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          {t("backToNews")}
        </Button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isAdmin ? (
            <Button
              render={
                <a
                  href={`/admin/news/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
              variant="outline"
              size="icon-lg"
              aria-label={t("editArticleAria")}
            >
              <PencilIcon aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant={saved ? "default" : "outline"}
            size="sm"
            onClick={toggleSaved}
            aria-pressed={saved}
            aria-label={saved ? t("unsaveArticleAria") : t("saveArticleAria")}
          >
            <BookmarkIcon
              data-icon="inline-start"
              aria-hidden
              fill={saved ? "currentColor" : "none"}
            />
            <span className="hidden sm:inline">
              {saved ? t("unsaveArticleAria") : t("saveArticleAria")}
            </span>
          </Button>
          <ShareMenu compact title={article.title} text={article.desc} />
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1",
          hasRightRail && "gap-5 xl:grid-cols-[minmax(0,1fr)_320px]",
        )}
      >
        <article className="flex min-w-0 flex-col gap-6">
          <Card className="gap-0 rounded-3xl py-0">
            {articleHeroIllustration ? (
              <div className="relative h-52 overflow-hidden sm:h-72 lg:h-80">
                <SmartImage
                  src={articleHeroIllustration}
                  alt=""
                  fit="cover"
                  fallbackMode="hide"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--glass-surface-strong)] via-transparent to-transparent"
                />
              </div>
            ) : null}

            <CardHeader className="gap-4 px-5 py-6 sm:px-8 sm:py-8">
              <CategoryBadge>{article.tag}</CategoryBadge>
              <CardTitle>
                <h1 className="glass-display text-3xl font-semibold leading-[1.08] sm:text-5xl">
                  <AcronymText>{article.title}</AcronymText>
                </h1>
              </CardTitle>
              {article.desc ? (
                <CardDescription className="max-w-4xl text-base leading-relaxed sm:text-lg">
                  <AcronymText>{article.desc}</AcronymText>
                </CardDescription>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--glass-ink-soft)]">
                {article.date ? (
                  <span className="inline-flex items-center gap-2">
                    <CalendarIcon className="size-4" aria-hidden />
                    {article.date}
                  </span>
                ) : null}
                {article.readingTime ? (
                  <span className="inline-flex items-center gap-2">
                    <ClockIcon className="size-4" aria-hidden />
                    {t("readingTimeMin", { min: article.readingTime })}
                  </span>
                ) : null}
              </div>
            </CardHeader>

            {article.keyTakeaway ? (
              <CardContent className="px-5 pb-7 sm:px-8">
                <div className="flex max-w-4xl items-start gap-3 rounded-2xl bg-[color:var(--glass-surface-strong)] p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-accent-deep)]">
                    <StarIcon className="size-4" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold text-[color:var(--glass-accent-deep)]">
                      {t("keyTakeawayLabel")}
                    </p>
                    <p className="text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
                      <AcronymText>{article.keyTakeaway}</AcronymText>
                    </p>
                  </div>
                </div>
              </CardContent>
            ) : null}

            <Separator className="bg-[color:var(--glass-ink-line)]" />
            <CardContent className="px-5 py-7 sm:px-8 sm:py-10">
              {article.content ? (
                <div
                  id={CONTENT_ANCHOR}
                  className="prose max-w-4xl scroll-mt-28 [--tw-prose-body:var(--glass-ink)] [--tw-prose-bold:var(--glass-ink)] [--tw-prose-headings:var(--glass-ink)] [--tw-prose-links:var(--glass-accent-deep)] [--tw-prose-quotes:var(--glass-ink-soft)] [--tw-prose-rule:var(--glass-ink-line)] prose-a:font-semibold prose-h2:glass-display prose-h2:mt-10 prose-h2:text-3xl prose-h2:font-semibold prose-h3:glass-display prose-h3:mt-8 prose-h3:text-2xl prose-h3:font-semibold prose-p:leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: enrichedContent }}
                />
              ) : (
                <p
                  id={CONTENT_ANCHOR}
                  className="max-w-3xl scroll-mt-28 text-sm text-[color:var(--glass-ink-soft)]"
                >
                  {t("articleContentUnavailable")}
                </p>
              )}
            </CardContent>
          </Card>

          {related.length > 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="glass-display px-1 text-2xl font-semibold">
                {t("readAlso")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/actualites/${item.slug ?? item.id}`}
                    className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--glass-bg-a)]"
                  >
                    <Card className="h-full transition-colors group-hover:ring-[color:var(--glass-accent-deep)]">
                      <CardHeader className="gap-2">
                        <CategoryBadge>{item.tag}</CategoryBadge>
                        <CardTitle>
                          <h3 className="text-base font-bold leading-snug">
                            <AcronymText>{item.title}</AcronymText>
                          </h3>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <CardDescription className="line-clamp-3 leading-relaxed">
                          <AcronymText>{item.desc}</AcronymText>
                        </CardDescription>
                      </CardContent>
                      <CardFooter className="flex-wrap gap-3 text-xs text-[color:var(--glass-ink-faint)]">
                        {item.date ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarIcon className="size-3.5" aria-hidden />
                            {item.date}
                          </span>
                        ) : null}
                        {item.readingTime ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ClockIcon className="size-3.5" aria-hidden />
                            {t("readingMinShort", { min: item.readingTime })}
                          </span>
                        ) : null}
                      </CardFooter>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        {hasRightRail ? (
          <aside className="flex min-w-0 flex-col gap-4" aria-label={t("summaryLabel")}>
            <div className="flex flex-col gap-4 xl:sticky xl:top-28">
              {hasSummary ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("summaryLabel")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-3">
                      {article.summary!.map((point, index) => (
                        <li key={index} className="flex gap-2.5">
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-accent-deep)]">
                            <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden />
                          </span>
                          <span className="text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
                            <AcronymText>{point}</AcronymText>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  {article.content ? (
                    <CardFooter>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={scrollToContent}
                        className="px-0"
                      >
                        {t("seeDetailedSummary")}
                        <ArrowRightIcon data-icon="inline-end" aria-hidden />
                      </Button>
                    </CardFooter>
                  ) : null}
                </Card>
              ) : null}

              {hasDocs ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("linkedDocsLabel")}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1">
                    {article.linkedDocs!.map((doc, index) => {
                      const isPdf = /\.pdf(\?|#|$)/i.test(doc.url);
                      return (
                        <a
                          key={index}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors hover:bg-[color:var(--glass-surface-strong)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                        >
                          <FileTextIcon
                            className="size-4 shrink-0 text-[color:var(--glass-accent-deep)]"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 text-sm font-medium text-[color:var(--glass-ink)]">
                            {doc.title}
                          </span>
                          <Badge variant="outline">
                            {isPdf ? t("docBadgePdf") : t("docBadgeDoc")}
                          </Badge>
                        </a>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}

              {hasFaqs ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("faqLabel")}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    {article.faqs!.map((faq, index) => (
                      <details
                        key={index}
                        className="group rounded-xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] px-3.5 py-3 open:bg-[color:var(--glass-surface-strong)]"
                      >
                        <summary className="flex min-h-6 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-[color:var(--glass-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] [&::-webkit-details-marker]:hidden">
                          <span>
                            <AcronymText>{faq.q}</AcronymText>
                          </span>
                          <ChevronDownIcon className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform group-open:rotate-180" aria-hidden />
                        </summary>
                        <p className="mt-3 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
                          <AcronymText>{faq.a}</AcronymText>
                        </p>
                      </details>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
