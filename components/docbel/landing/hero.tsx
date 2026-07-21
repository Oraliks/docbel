"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  BookOpenIcon,
  FolderOpenIcon,
  SearchIcon,
} from "lucide-react";
import {
  Briefcase,
  Buildings,
  Calculator,
  Scales,
} from "@phosphor-icons/react";
import type { NewsItem } from "@/lib/docbel-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppState } from "@/lib/app-state-context";

interface LandingHeroProps {
  articles: NewsItem[];
  loading?: boolean;
}

// Article de repli localise : le hero reste utile lorsque la source de donnees
// est momentanement indisponible, sans fetch client au premier affichage.
function buildFallbackArticle(t: ReturnType<typeof useTranslations>): NewsItem {
  return {
    id: "placeholder-c1",
    slug: undefined,
    tag: t("fallbackTag"),
    title: t("fallbackTitle"),
    desc: t("fallbackDesc"),
    date: t("fallbackDate"),
    color: "var(--glass-accent-deep)",
  };
}

/**
 * Illustration volontairement secondaire : elle donne du relief au guichet
 * sans bouger en boucle, disparait en mode simple et reste neutre pour les
 * technologies d'assistance.
 */
function GuidedArtwork() {
  const tiles = [Briefcase, Scales, Buildings, Calculator];

  return (
    <div
      aria-hidden
      data-a11y-secondary="true"
      className="pointer-events-none relative hidden min-h-[230px] items-center justify-center sm:flex"
    >
      <div
        className="absolute size-48 rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--glass-accent-c)" }}
      />
      <div className="absolute size-44 rounded-full border border-[color:var(--glass-border)]" />
      <div className="absolute size-28 rounded-full border border-[color:var(--glass-border)] opacity-70" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/3d/book.png"
        alt=""
        className="relative z-10 size-32 object-contain drop-shadow-[0_18px_24px_rgba(50,34,100,0.28)] motion-safe:animate-[fadeInUp_0.45s_ease_both] sm:size-40"
      />

      {tiles.map((Icon, index) => (
        <span
          key={Icon.displayName ?? index}
          className={`glass-icon-tile absolute z-20 flex size-10 items-center justify-center rounded-2xl sm:size-11 ${
            index === 0
              ? "top-[7%] left-[20%]"
              : index === 1
                ? "top-[12%] right-[17%]"
                : index === 2
                  ? "bottom-[8%] left-[17%]"
                  : "right-[20%] bottom-[4%]"
          }`}
        >
          <Icon
            weight="duotone"
            className="size-5 text-[color:var(--glass-accent-deep)]"
          />
        </span>
      ))}
    </div>
  );
}

function FeaturedStory({ article }: { article: NewsItem }) {
  const t = useTranslations("public.home");
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
        <span className="rounded-full bg-[color:var(--glass-surface-strong)] px-2.5 py-1 text-[color:var(--glass-accent-deep)]">
          {article.tag}
        </span>
        {article.date && <span>{article.date}</span>}
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] font-bold leading-snug text-[color:var(--glass-ink)]">
        {article.title}
      </p>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-accent-deep)]">
        <BookOpenIcon className="size-3.5" aria-hidden />
        {t("ctaReadArticle")}
        <ArrowRightIcon className="size-3.5" aria-hidden />
      </span>
    </>
  );

  const className =
    "glass-interactive block rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";
  const href = article.slug ? `/actualites/${article.slug}` : "/actualites";

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function GuidedHero({ article }: { article: NewsItem }) {
  const t = useTranslations("public.home");
  const { openSearch } = useAppState();

  return (
    <section
      aria-labelledby="home-guided-heading"
      className="glass-surface relative isolate overflow-hidden p-5 sm:p-7 lg:p-9"
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 82% 22%, var(--glass-accent-a), transparent 32%), radial-gradient(circle at 55% 110%, var(--glass-accent-c), transparent 42%)",
        }}
      />

      <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1.12fr)_minmax(300px,0.88fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col items-start">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-accent-deep)]">
            <span className="size-1.5 rounded-full bg-[color:var(--glass-accent-deep)]" />
            {t("wizardEyebrow")}
          </p>
          <h1
            id="home-guided-heading"
            className="glass-display max-w-3xl text-[34px] font-semibold leading-[1.02] sm:text-[46px] lg:text-[52px]"
          >
            {t.rich("wizardTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.7] text-[color:var(--glass-ink-soft)] sm:text-[15px]">
            {t("wizardDescription")}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/mon-dossier"
              className="glass-cta glass-interactive inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold"
            >
              <FolderOpenIcon className="size-4" aria-hidden />
              {t("ctaCreateDossier")}
              <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={openSearch}
              className="glass-interactive inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3 text-[14px] font-bold text-[color:var(--glass-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            >
              <SearchIcon className="size-4" aria-hidden />
              {t("searchPrefix")}
            </button>
          </div>
        </div>

        <aside className="grid min-w-0 gap-3 sm:grid-cols-[0.9fr_1.1fr] lg:grid-cols-1">
          <GuidedArtwork />
          <FeaturedStory article={article} />
        </aside>
      </div>
    </section>
  );
}

function GuidedHeroSkeleton() {
  return (
    <section className="glass-surface grid min-h-[420px] gap-8 p-6 sm:p-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-3 h-12 w-48 rounded-full" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-[24px]" />
    </section>
  );
}

export function LandingHero({ articles, loading = false }: LandingHeroProps) {
  const t = useTranslations("public.home");
  const article = articles[0] ?? buildFallbackArticle(t);

  return loading && articles.length === 0 ? (
    <GuidedHeroSkeleton />
  ) : (
    <GuidedHero article={article} />
  );
}
