"use client";

import { useRouter } from "next/navigation";
import type { NewsItem } from "@/lib/docbel-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, TrendingUpIcon } from "lucide-react";

interface LandingHeroProps {
  article: NewsItem | null;
  loading?: boolean;
}

const FALLBACK_ARTICLE: NewsItem = {
  id: "placeholder-c1",
  slug: undefined,
  tag: "Annonce ONEM · 15.04",
  title: "Le formulaire C1 passe à 12 mois en ligne.",
  desc: "L'ONEM simplifie la procédure : vous avez désormais une année entière pour introduire votre demande d'allocations depuis l'espace en ligne. On vous explique tout en 6 minutes.",
  date: "09 MAI 26",
  color: "#9F7CFF",
};

function formatHeadline(title: string) {
  const segments = title.split(/(\d+\s?mois|\d+\s?€|en\s+un\s+geste|12\s+mois)/i);
  return segments.map((segment, index) =>
    index % 2 === 1 ? <em key={index}>{segment}</em> : <span key={index}>{segment}</span>,
  );
}

function FeaturedArtwork() {
  return (
    <div
      className="relative flex h-[260px] items-center justify-center overflow-hidden rounded-[20px]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
      }}
    >
      <div
        className="hero-breath absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.5) 0%, transparent 40%)",
        }}
      />
      <div
        className="relative flex h-[78%] w-[65%] -rotate-6 flex-col gap-2.5 rounded-2xl bg-white/95 p-4 shadow-[0_18px_50px_rgba(40,15,80,0.30)] dark:bg-[rgba(40,36,52,0.96)]"
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className="text-[9px] font-extrabold tracking-[0.12em]"
            style={{ color: "var(--glass-accent-a)" }}
          >
            FORMULAIRE C1
          </span>
          <span
            className="text-[9px] font-bold"
            style={{ color: "var(--glass-accent-a)" }}
          >
            ● ● ●
          </span>
        </div>
        <div className="h-[5px] w-3/4 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-[5px] rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-[5px] w-1/2 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-[5px] rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-[5px] w-3/4 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-[5px] w-1/2 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div
          className="absolute right-3.5 bottom-3.5 size-[38px] rounded-xl"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
          }}
        />
      </div>
      <div
        className="absolute top-[58%] left-[55%] flex w-[120px] flex-col gap-1.5 rotate-[8deg] rounded-xl bg-white/95 p-2.5 shadow-[0_12px_30px_rgba(40,15,80,0.25)] dark:bg-[rgba(40,36,52,0.96)]"
      >
        <div className="h-1 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-1 w-1/2 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-1 w-3/4 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
        <div className="h-1 rounded-full bg-[rgba(159,124,255,0.20)] dark:bg-white/10" />
      </div>
    </div>
  );
}

function FeaturedArticle({ article }: { article: NewsItem }) {
  const router = useRouter();
  return (
    <article className="glass-surface relative grid min-h-[340px] gap-9 overflow-hidden p-9 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="flex flex-col">
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

        <h1 className="glass-display mt-5 text-[44px] font-semibold leading-[1.04] lg:text-[46px]">
          {formatHeadline(article.title)}
        </h1>

        <p className="mt-4 max-w-[480px] text-[14.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
          {article.desc}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => article.slug && router.push(`/actualites/${article.slug}`)}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold transition hover:opacity-90"
            style={{
              background: "var(--glass-ink)",
              color: "var(--glass-bg-a)",
            }}
          >
            Lire l&apos;article
            <ArrowRightIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/outils")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            Calculer mes droits
          </button>
        </div>
      </div>

      <FeaturedArtwork />

      <span className="absolute top-9 right-10 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
        VOL. III · N°12 · {article.date}
      </span>
    </article>
  );
}

function StatusCard() {
  return (
    <aside className="glass-surface flex flex-col gap-4 p-7">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
          Mon estimation actuelle
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            background: "var(--glass-surface)",
            color: "var(--glass-accent-deep)",
          }}
        >
          <TrendingUpIcon className="size-3" strokeWidth={2.4} />
          +2.1%
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-[18px] p-6 text-white"
        style={{
          backgroundImage:
            "linear-gradient(135deg, var(--glass-status-from) 0%, var(--glass-status-to) 100%)",
        }}
      >
        <span
          className="absolute -top-10 -right-10 size-40 rounded-full bg-[rgba(255,200,140,0.40)] dark:bg-[rgba(180,160,200,0.12)]"
          style={{ filter: "blur(28px)" }}
        />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
            Allocation chômage
          </div>
          <div className="glass-display mt-1 text-[42px] leading-none font-semibold">
            47,80 €
            <small className="ml-1.5 text-[14px] font-semibold opacity-70">/jour</small>
          </div>
          <div className="mt-1.5 text-[12px] opacity-80">
            Sur base d&apos;un salaire de référence de 2 850 €
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[12px]">
        <div className="flex justify-between">
          <span className="text-[color:var(--glass-ink-faint)]">Mise à jour</span>
          <span className="font-bold">il y a 2 jours</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[color:var(--glass-ink-faint)]">Catégorie</span>
          <span className="font-bold">Cohabitant · 1ʳᵉ pér.</span>
        </div>
      </div>

      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold transition hover:opacity-90"
        style={{
          background: "var(--glass-ink)",
          color: "var(--glass-bg-a)",
        }}
      >
        Recalculer
        <ArrowRightIcon className="size-4" />
      </button>
    </aside>
  );
}

function FeaturedArticleSkeleton() {
  return (
    <article className="glass-surface relative grid min-h-[340px] gap-9 overflow-hidden p-9 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-44 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
        <Skeleton className="mt-2 h-11 w-40 rounded-full" />
      </div>
      <Skeleton className="h-[260px] w-full rounded-[20px]" />
    </article>
  );
}

export function LandingHero({ article, loading = false }: LandingHeroProps) {
  // While the news API is in flight, show a skeleton in place of the article.
  // The status card is static placeholder data so it renders immediately.
  return (
    <section className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      {loading && !article ? (
        <FeaturedArticleSkeleton />
      ) : (
        <FeaturedArticle article={article ?? FALLBACK_ARTICLE} />
      )}
      <StatusCard />
    </section>
  );
}
