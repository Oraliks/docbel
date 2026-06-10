"use client";

import { useRouter } from "next/navigation";
import type { NewsItem } from "@/lib/docbel-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightIcon, CalculatorIcon, FolderOpenIcon, TrendingUpIcon } from "lucide-react";
import { Buildings, CalendarBlank, Phone, Scales } from "@phosphor-icons/react";

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

// Bulles d'icônes flottantes (glassmorphism + glow néon), façon hero maquette.
// Icônes Phosphor (duotone) — rendu plus riche que le mono-trait pour le décor.
const HERO_BUBBLES: {
  Icon: typeof Scales;
  hue: string;
  cls: string;
  delay: string;
}[] = [
  { Icon: Scales, hue: "#FF7A7A", cls: "left-[5%] top-[13%]", delay: "0s" },
  { Icon: Phone, hue: "#FF5FA2", cls: "right-[7%] top-[7%]", delay: "1s" },
  { Icon: Buildings, hue: "#8B5CF6", cls: "left-[3%] bottom-[15%]", delay: "2s" },
  { Icon: CalendarBlank, hue: "#C084FC", cls: "right-[6%] bottom-[10%]", delay: "1.5s" },
];

/**
 * Illustration du hero — reproduction « différente » de la maquette dark :
 * pile de cartes en verre dépoli (document/dossier abstrait) + halo lumineux
 * + bulles d'icônes flottantes glassmorphism qui glow. Aucun asset 3D requis ;
 * tout est en CSS + icônes Phosphor → s'adapte clair/sombre via les tokens.
 */
function FeaturedArtwork() {
  return (
    <div
      className="relative flex h-[260px] items-center justify-center overflow-hidden rounded-[20px]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
      }}
    >
      {/* Halo lumineux central (glow) — respire. */}
      <div
        className="hero-breath absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
          filter: "blur(26px)",
        }}
      />

      {/* Illustration 3D (livre) — asset CC0 Fluent Emoji ; drop-shadow violet
          pour l'harmoniser au thème mauve (cf. AGENTS.md › Design). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/3d/book.png"
        alt=""
        aria-hidden
        className="relative h-[160px] w-[160px] object-contain"
        style={{
          filter:
            "drop-shadow(0 18px 28px rgba(20,10,45,0.5)) drop-shadow(0 0 26px color-mix(in oklab, var(--glass-accent-deep) 60%, transparent))",
        }}
      />

      {/* Bulles d'icônes flottantes (glassmorphism + glow néon). */}
      {HERO_BUBBLES.map(({ Icon, hue, cls, delay }) => (
        <span
          key={cls}
          className={`hero-float absolute ${cls} flex size-11 items-center justify-center rounded-2xl border border-white/30 bg-white/10 backdrop-blur-md`}
          style={{
            animationDelay: delay,
            boxShadow: `0 8px 22px rgba(20,10,45,0.35), 0 0 18px ${hue}55`,
          }}
        >
          <Icon weight="duotone" size={22} color={hue} />
        </span>
      ))}
    </div>
  );
}

function FeaturedArticle({ article }: { article: NewsItem }) {
  const router = useRouter();
  return (
    <article className="glass-surface relative flex min-h-[340px] flex-col gap-7 overflow-hidden p-7 sm:p-9">
      {/*
        Masthead — tag (gauche) + référence éditoriale (droite) posés sur une
        vraie ligne d'en-tête séparée par un filet. Remplace le label VOL.
        absolument positionné (top-9 right-10) qui chevauchait le titre et
        l'artwork sous le breakpoint lg. Donne une hiérarchie de "une".
      */}
      <div className="flex items-center justify-between gap-4 border-b border-[color:var(--glass-ink-line)] pb-5">
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
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)] sm:text-[11px]">
          VOL. III · N°12 · {article.date}
        </span>
      </div>

      <div className="grid gap-9 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="flex flex-col">
          <h1 className="glass-display text-[34px] font-semibold leading-[1.06] sm:text-[44px] lg:text-[46px] lg:leading-[1.04]">
            {formatHeadline(article.title)}
          </h1>

          <p className="mt-4 max-w-[480px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {article.desc}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {/* CTA primaire : mène vers le wizard d'orientation. Le hero
                porte les démarches grand public — c'est l'action n°1 du
                site, plus prioritaire que la lecture d'un article ou un
                calcul ponctuel. */}
            <button
              type="button"
              onClick={() => router.push("/mon-dossier")}
              className="glass-cta inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold"
            >
              <FolderOpenIcon className="size-4" />
              Créer mon dossier
              <ArrowRightIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => article.slug && router.push(`/actualites/${article.slug}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10 dark:border-[color:var(--glass-accent-deep)]/40 dark:hover:shadow-[0_0_18px_rgba(139,92,246,0.3)]"
            >
              Lire l&apos;article
              <ArrowRightIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push("/outils")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10 dark:border-[color:var(--glass-accent-deep)]/40 dark:hover:shadow-[0_0_18px_rgba(139,92,246,0.3)]"
            >
              <CalculatorIcon className="size-4" />
              Calculer mes droits
            </button>
          </div>
        </div>

        <FeaturedArtwork />
      </div>
    </article>
  );
}

function StatusCard() {
  const router = useRouter();
  return (
    <aside className="glass-surface flex flex-col gap-5 p-7">
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

      {/* Méta de l'estimation, détachée du bloc chiffré par un filet pour la
          hiérarchie. Données encore placeholder (cf. redesign : mock conservé). */}
      <div className="flex flex-col gap-2 border-t border-[color:var(--glass-ink-line)] pt-4 text-[12px]">
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
        onClick={() => router.push("/outils")}
        className="glass-cta inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[13.5px] font-bold"
      >
        Recalculer mon estimation
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
