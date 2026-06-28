"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { NewsItem } from "@/lib/docbel-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, BookOpenIcon, FolderOpenIcon } from "lucide-react";
import { Briefcase, Buildings, CalendarBlank, Calculator, Scales, Sparkle, User } from "@phosphor-icons/react";
import { SimulatorCard } from "@/components/docbel/landing/simulator-card";

interface LandingHeroProps {
  articles: NewsItem[];
  loading?: boolean;
}

// Article de repli affiché si l'API ne renvoie aucune « une » (jamais de hero
// vide). Construit à partir des traductions → contenu localisé.
function buildFallbackArticle(
  t: ReturnType<typeof useTranslations>,
): NewsItem {
  return {
    id: "placeholder-c1",
    slug: undefined,
    tag: t("fallbackTag"),
    title: t("fallbackTitle"),
    desc: t("fallbackDesc"),
    date: t("fallbackDate"),
    color: "#9F7CFF",
  };
}

function formatHeadline(title: string) {
  const segments = title.split(/(\d+\s?mois|\d+\s?€|en\s+un\s+geste|12\s+mois)/i);
  return segments.map((segment, index) =>
    index % 2 === 1 ? <em key={index}>{segment}</em> : <span key={index}>{segment}</span>,
  );
}

// Tuiles d'icônes en verre qui gravitent autour du livre 3D central (façon
// maquette) : citoyen, justice, emploi, institution, calcul — les piliers du
// site. Glassmorphism + glow violet (.glass-icon-tile), lévitation décalée.
const ORBIT_TILES: {
  Icon: typeof Scales;
  cls: string;
  delay: string;
}[] = [
  { Icon: User, cls: "left-[42%] top-[4%]", delay: "0s" },
  { Icon: Scales, cls: "left-[5%] top-[26%]", delay: "0.7s" },
  { Icon: Briefcase, cls: "right-[5%] top-[22%]", delay: "1.1s" },
  { Icon: Buildings, cls: "left-[8%] bottom-[18%]", delay: "1.7s" },
  { Icon: Calculator, cls: "right-[7%] bottom-[14%]", delay: "2.3s" },
];

// Étincelles dispersées (sparkles) — petits éclats 4 branches qui scintillent.
const SPARKLES: { cls: string; size: number; delay: string }[] = [
  { cls: "left-[24%] top-[12%]", size: 13, delay: "0s" },
  { cls: "right-[26%] top-[34%]", size: 9, delay: "0.5s" },
  { cls: "left-[32%] bottom-[12%]", size: 10, delay: "1s" },
  { cls: "right-[33%] bottom-[30%]", size: 12, delay: "1.5s" },
];

// Glow violet partagé par les illustrations 3D (drop-shadow porté + halo mauve)
// pour les harmoniser au thème (cf. AGENTS.md › Design).
const ASSET_GLOW =
  "drop-shadow(0 14px 22px rgba(20,10,45,0.45)) drop-shadow(0 0 20px color-mix(in oklab, var(--glass-accent-deep) 55%, transparent))";

/**
 * Illustration animée du hero — reproduit la maquette : un livre/dossier 3D
 * (asset CC0) en lévitation sur un socle lumineux, entouré de TUILES d'icônes
 * en verre qui orbitent (citoyen, justice, emploi, institution, calcul) + des
 * étincelles qui scintillent + des anneaux orbitaux (deux liserés statiques, un
 * arc conique qui tourne) + un halo qui respire. PAS de panneau propre : le
 * fond dégradé est porté par la nappe pleine largeur du bloc hero (cf.
 * HeroCarousel), l'illustration se fond dedans. Keyframes CSS gardées par
 * `prefers-reduced-motion` (hero-float / hero-spin / hero-breath / hero-twinkle) ;
 * s'adapte clair/sombre via les tokens `--glass-*`.
 */
function FeaturedArtwork() {
  return (
    <div className="relative flex min-h-[190px] flex-1 items-center justify-center sm:min-h-[280px]">
      {/* Halo lumineux central (glow) — respire. */}
      <div
        className="hero-breath absolute top-1/2 left-1/2 size-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
          filter: "blur(26px)",
        }}
      />

      {/* Anneaux orbitaux : deux liserés statiques + un arc conique qui tourne. */}
      <div className="absolute top-1/2 left-1/2 size-[224px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
      <div className="absolute top-1/2 left-1/2 size-[148px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      <div
        className="hero-spin absolute top-1/2 left-1/2 size-[224px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--glass-accent-deep) 55%, transparent) 55deg, transparent 120deg, color-mix(in oklab, var(--glass-accent-c) 50%, transparent) 220deg, transparent 310deg)",
          maskImage:
            "radial-gradient(closest-side, transparent 72%, #000 74%, #000 78%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(closest-side, transparent 72%, #000 74%, #000 78%, transparent 80%)",
          opacity: 0.8,
        }}
      />

      {/* Socle lumineux sous le livre. */}
      <div
        className="absolute bottom-[22%] left-1/2 h-[28px] w-[148px] -translate-x-1/2 rounded-[50%]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, transparent 72%)",
          filter: "blur(9px)",
        }}
      />

      {/* Étincelles (sparkles) qui scintillent. */}
      {SPARKLES.map(({ cls, size, delay }) => (
        <Sparkle
          key={cls}
          weight="fill"
          size={size}
          className={`hero-twinkle absolute z-20 ${cls} text-white`}
          style={{
            animationDelay: delay,
            filter: "drop-shadow(0 0 6px rgba(255,255,255,0.85))",
          }}
        />
      ))}

      {/* Livre 3D central — flotte au-dessus du socle et des anneaux. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/3d/book.png"
        alt=""
        aria-hidden
        className="hero-float relative z-10 h-[140px] w-[140px] object-contain"
        style={{ filter: ASSET_GLOW }}
      />

      {/* Tuiles d'icônes en verre qui orbitent (lévitation décalée par tuile). */}
      {ORBIT_TILES.map(({ Icon, cls, delay }) => (
        <span
          key={cls}
          className={`hero-float glass-icon-tile absolute z-30 ${cls} flex size-11 items-center justify-center rounded-2xl border border-white/35 bg-white/15 backdrop-blur-md`}
          style={{ animationDelay: delay }}
        >
          <Icon weight="duotone" size={22} color="#6D4BFF" />
        </span>
      ))}
    </div>
  );
}

function HeroCarousel({ articles }: { articles: NewsItem[] }) {
  const router = useRouter();
  const t = useTranslations("public.home");
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = articles.length;
  const article = articles[index] ?? articles[0];

  // Auto-défilement doux : pause au survol/focus, coupé s'il n'y a qu'une seule
  // « une » ou si l'utilisateur a demandé moins d'animations. `setIndex` est
  // appelé dans le callback du timer (pas de setState synchrone dans l'effet).
  useEffect(() => {
    if (count <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 6500);
    return () => window.clearInterval(id);
  }, [count, paused]);

  return (
    <article
      className="glass-surface relative flex min-h-[340px] flex-col overflow-hidden p-4 sm:p-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription={t("carouselRoleDescription")}
      aria-label={t("carouselLabel")}
    >
      {/*
        Nappe de couleur du BLOC UNIQUE (façon maquette) : voile lavande qui se
        renforce vers la droite (sous le simulateur) + halo violet derrière
        l'illustration centrale. Transparente côté texte pour préserver le
        contraste de lecture. Pur décor (pointer-events-none).
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 46% 90% at 46% 48%, var(--glass-accent-d) 0%, transparent 66%), linear-gradient(115deg, transparent 0%, var(--glass-accent-a) 42%, var(--glass-accent-c) 75%, var(--glass-accent-deep) 100%)",
          opacity: 0.85,
        }}
      />

      <div className="relative grid flex-1 gap-5 sm:gap-8 lg:grid-cols-[1.02fr_1.18fr_0.95fr] lg:items-stretch">
        {/* ── Colonne texte (gauche) ── */}
        <div className="flex flex-col justify-center py-1 lg:pl-2">
          {/*
            Masthead — pastille thème + date de publication réelle, côte à côte
            (plus de filet pleine largeur : l'illustration monte jusqu'en haut
            du bloc). Keyé sur l'article courant → fondu au changement de slide.
            La date vient de `article.publishedAt` (cf. app/page.tsx).
          */}
          <div
            key={`masthead-${article.id}`}
            className="mb-5 flex animate-[fadeInUp_0.45s_ease] flex-wrap items-center gap-3 motion-reduce:animate-none"
          >
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white"
              style={{ background: "var(--glass-accent-deep)" }}
            >
              <span className="size-1.5 rounded-full bg-white/80" />
              {article.tag}
            </span>
            {article.date && (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)] sm:text-[11px]">
                <CalendarBlank size={13} weight="bold" aria-hidden />
                {article.date}
              </span>
            )}
          </div>

          {/* Contenu qui change d'un slide à l'autre — fondu au changement. */}
          <div
            key={article.id}
            className="flex animate-[fadeInUp_0.45s_ease] flex-col motion-reduce:animate-none"
          >
            <h1 className="glass-display text-[30px] font-semibold leading-[1.08] sm:text-[38px] lg:text-[32px] xl:text-[40px]">
              {formatHeadline(article.title)}
            </h1>

            <p className="mt-4 max-w-[440px] text-[13.5px] leading-[1.65] text-[color:var(--glass-ink-soft)]">
              {article.desc}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {/* CTA primaire : mène vers le wizard d'orientation (action n°1). */}
              <button
                type="button"
                onClick={() => router.push("/mon-dossier")}
                className="glass-cta inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold"
              >
                <FolderOpenIcon className="size-4" />
                {t("ctaCreateDossier")}
                <ArrowRightIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => article.slug && router.push(`/actualites/${article.slug}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:border-[color:var(--glass-accent-deep)]/40 dark:hover:bg-white/10 dark:hover:shadow-[0_0_18px_rgba(139,92,246,0.3)]"
              >
                <BookOpenIcon className="size-4" />
                {t("ctaReadArticle")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Illustration centrale + points du carrousel (centrés dessous) ── */}
        <div className="relative flex h-full flex-col">
          <FeaturedArtwork />
          {count > 1 && (
            <div
              className="relative z-30 mt-3 flex items-center justify-center gap-2"
              aria-label={t("carouselPickLabel")}
            >
              {articles.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={t("carouselSlideLabel", {
                    index: i + 1,
                    total: count,
                    title: a.title,
                  })}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index
                      ? "w-6 bg-[color:var(--glass-accent-deep)]"
                      : "w-2 bg-white/60 hover:bg-white/90"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Simulateur posé PAR-DESSUS le bloc (carte sombre incrustée) —
            FONCTIONNEL : moteur lib/simulateur-chomage (mêmes chiffres que
            /outils), persistance localStorage. ── */}
        <SimulatorCard />
      </div>
    </article>
  );
}

function FeaturedArticleSkeleton() {
  // Reflète la vraie structure : bloc unique 3 colonnes (texte | illustration |
  // simulateur incrusté), cf. règle perf "loading adapté à la structure UI".
  return (
    <article className="glass-surface relative grid min-h-[340px] gap-8 overflow-hidden p-6 sm:p-7 lg:grid-cols-[1.02fr_1.18fr_0.95fr] lg:items-center">
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
      <Skeleton className="h-[280px] w-full rounded-[20px]" />
    </article>
  );
}

export function LandingHero({ articles, loading = false }: LandingHeroProps) {
  const t = useTranslations("public.home");
  // BLOC UNIQUE (façon maquette) : texte + illustration centrale (points du
  // carrousel dessous) + simulateur posé par-dessus — le tout rendu par
  // HeroCarousel. Repli sur un article placeholder si l'API n'a rien renvoyé,
  // pour ne jamais afficher un hero vide.
  const list = articles.length > 0 ? articles : [buildFallbackArticle(t)];
  return loading && articles.length === 0 ? (
    <FeaturedArticleSkeleton />
  ) : (
    <HeroCarousel articles={list} />
  );
}
