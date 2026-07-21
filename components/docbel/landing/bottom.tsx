"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  FileTextIcon,
  FolderOpenIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HomeIcon,
  type LucideIcon,
  PlayCircleIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type { NewsItem } from "@/lib/docbel-data";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dossier réel (DocumentBundle) mis en avant dans le panneau de droite —
 * alimenté par app/page.tsx (mêmes champs que la requête « populaires »
 * de /mon-dossier).
 */
export interface PopularBundle {
  slug: string;
  name: string;
  itemCount: number;
  color: string;
  lifeEventCategory: string | null;
}

interface LandingBottomProps {
  news: NewsItem[];
  loading?: boolean;
  /**
   * Dossiers réels à afficher à la place des guides statiques.
   * Absent ou vide → rendu d'origine conservé (rétrocompatible).
   */
  bundles?: PopularBundle[];
}

interface ResourceItem {
  Icon: LucideIcon;
  variant: "a" | "b" | "c" | "d";
  /** Clé i18n du titre. */
  titleKey: string;
  /** Durée de lecture (min) — injectée dans le libellé méta via ICU. */
  minutes: number;
  href?: string;
}

const RESOURCES: ResourceItem[] = [
  {
    Icon: PlayCircleIcon,
    variant: "a",
    titleKey: "resource1Title",
    minutes: 8,
  },
  {
    Icon: BookOpenIcon,
    variant: "b",
    titleKey: "resource2Title",
    minutes: 12,
  },
  {
    Icon: FileTextIcon,
    variant: "c",
    titleKey: "resource3Title",
    minutes: 10,
  },
  {
    Icon: ZapIcon,
    variant: "d",
    titleKey: "resource4Title",
    minutes: 6,
  },
];

const RESOURCE_BG: Record<ResourceItem["variant"], string> = {
  a: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
  b: "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
  c: "linear-gradient(135deg, var(--glass-accent-deep), var(--glass-accent-a))",
  d: "linear-gradient(135deg, var(--glass-accent-d), var(--glass-warning))",
};

// Icône par catégorie d'événement de vie (cf. DocumentBundle.lifeEventCategory :
// "emploi", "formation", "famille", "logement", "sante"…). Dossier en repli
// pour les catégories inconnues ou absentes.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  emploi: BriefcaseIcon,
  formation: GraduationCapIcon,
  famille: UsersIcon,
  logement: HomeIcon,
  sante: HeartPulseIcon,
};

function bundleIcon(category: string | null): LucideIcon {
  if (!category) return FolderOpenIcon;
  return CATEGORY_ICONS[category.toLowerCase()] ?? FolderOpenIcon;
}

export function LandingBottom({
  news,
  loading = false,
  bundles,
}: LandingBottomProps) {
  const t = useTranslations("public.home");
  const visibleNews = news.slice(0, 4);
  // Dossiers réels disponibles → ils remplacent les guides statiques du
  // panneau « Ressources » ; sinon le rendu d'origine est conservé tel quel.
  const bundleList = bundles ?? [];
  const showBundles = bundleList.length > 0;

  return (
    <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="glass-surface p-5 sm:p-7">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="glass-display text-[24px] font-semibold leading-none">
            {t("recentNewsTitle")}
          </h2>
          <Link
            href="/actualites"
            className="glass-interactive inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          >
            {t("seeAll")}
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="flex flex-col">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={`grid grid-cols-[60px_1fr_auto] items-center gap-4 py-3.5 ${
                  index < 2 ? "border-b border-[color:var(--glass-ink-line)]" : ""
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-7" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))
          ) : visibleNews.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[color:var(--glass-ink-faint)]">
              {t("noNews")}
            </p>
          ) : (
            visibleNews.map((item, index) => {
              return (
                <Link
                  key={item.id}
                  href={`/actualites/${item.slug ?? item.id}`}
                  className={`glass-interactive -mx-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] sm:grid-cols-[7rem_minmax(0,1fr)_auto] ${
                    index < visibleNews.length - 1
                      ? "border-b border-[color:var(--glass-ink-line)]"
                      : ""
                  }`}
                >
                  <time className="col-span-2 text-xs font-bold text-[color:var(--glass-accent-deep)] sm:col-span-1">
                    {item.date}
                  </time>
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-bold tracking-tight">{item.title}</div>
                    <div className="mt-1 text-[11.5px] text-[color:var(--glass-ink-faint)]">
                      {item.readingTime
                        ? t("readingTime", { minutes: item.readingTime })
                        : item.desc.slice(0, 80)}
                    </div>
                  </div>
                  <span className="rounded-full bg-[color:var(--glass-surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-soft)]">
                    {item.tag}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="glass-surface flex flex-col gap-3.5 p-5 sm:p-7">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="glass-display text-[24px] font-semibold leading-none">
            {showBundles ? t("popularDossiersTitle") : t("resourcesTitle")}
          </h2>
          <Link
            href={showBundles ? "/mon-dossier" : "/outils"}
            className="glass-interactive inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          >
            {t("seeAll")}
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </Link>
        </div>
        {showBundles &&
          bundleList.slice(0, 4).map((bundle) => {
            const Icon = bundleIcon(bundle.lifeEventCategory);
            return (
              <Link
                key={bundle.slug}
                href={`/d/${bundle.slug}`}
                className="glass-interactive group flex min-h-16 items-center gap-3.5 rounded-2xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                style={{ background: "var(--glass-surface)" }}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--glass-border)]"
                  style={{
                    background: `color-mix(in oklab, ${bundle.color} 16%, transparent)`,
                    color: bundle.color,
                  }}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold tracking-tight">
                    {bundle.name}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[color:var(--glass-ink-faint)]">
                    {t("dossierDocCount", { count: bundle.itemCount })}
                  </div>
                </div>
                <ArrowRightIcon
                  className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                  style={{ color: "var(--glass-ink-faint)" }}
                />
              </Link>
            );
          })}
        {!showBundles && RESOURCES.map((res) => {
          const Icon = res.Icon;
          return (
            <Link
              key={res.titleKey}
              href={res.href ?? "/outils"}
              className="glass-interactive group flex min-h-16 items-center gap-3.5 rounded-2xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              style={{ background: "var(--glass-surface)" }}
            >
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-primary-foreground"
                style={{ backgroundImage: RESOURCE_BG[res.variant] }}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold tracking-tight">
                  {t(res.titleKey as Parameters<typeof t>[0])}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[color:var(--glass-ink-faint)]">
                  {t("resourceMeta", { minutes: res.minutes })}
                </div>
              </div>
              <ArrowRightIcon
                className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--glass-ink-faint)" }}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
