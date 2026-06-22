"use client";

import { useRouter } from "next/navigation";
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
  d: "linear-gradient(135deg, var(--glass-accent-d), #FFE070)",
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

// Abréviations de mois (clés i18n) — l'ordre suit getMonth() (0 = janvier).
const MONTH_KEYS = [
  "monthJan",
  "monthFeb",
  "monthMar",
  "monthApr",
  "monthMay",
  "monthJun",
  "monthJul",
  "monthAug",
  "monthSep",
  "monthOct",
  "monthNov",
  "monthDec",
] as const;

function splitDate(date: string, monthLabels: readonly string[]) {
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      day: String(parsed.getDate()).padStart(2, "0"),
      month: monthLabels[parsed.getMonth()],
    };
  }
  const tokens = date.split(/\s+/);
  const day = tokens[0] ?? "—";
  const month = (tokens[1] ?? "").toUpperCase().slice(0, 4);
  return { day, month };
}

export function LandingBottom({
  news,
  loading = false,
  bundles,
}: LandingBottomProps) {
  const router = useRouter();
  const t = useTranslations("public.home");
  // Libellés de mois résolus une fois (clés dynamiques → cast requis).
  const monthLabels = MONTH_KEYS.map((key) => t(key as Parameters<typeof t>[0]));
  const visibleNews = news.slice(0, 4);
  // Dossiers réels disponibles → ils remplacent les guides statiques du
  // panneau « Ressources » ; sinon le rendu d'origine est conservé tel quel.
  const bundleList = bundles ?? [];
  const showBundles = bundleList.length > 0;

  return (
    <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="glass-surface p-7">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="glass-display text-[24px] font-semibold leading-none">
            {t("recentNewsTitle")}
          </h2>
          <button
            type="button"
            onClick={() => router.push("/actualites")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            {t("seeAll")}
            <ArrowRightIcon className="size-3.5" />
          </button>
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
              const { day, month } = splitDate(item.date, monthLabels);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    router.push(`/actualites/${item.slug ?? item.id}`)
                  }
                  className={`-mx-3 grid grid-cols-[60px_1fr_auto] items-center gap-4 rounded-xl px-3 py-3.5 text-left outline-none transition-colors hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/[0.05] ${
                    index < visibleNews.length - 1
                      ? "border-b border-[color:var(--glass-ink-line)]"
                      : ""
                  }`}
                >
                  <div className="text-center">
                    <div className="glass-display text-[22px] font-semibold leading-none">
                      {day}
                    </div>
                    <div
                      className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                      style={{ color: "var(--glass-accent-deep)" }}
                    >
                      {month}
                    </div>
                  </div>
                  <div>
                    <div className="text-[14.5px] font-bold tracking-tight">{item.title}</div>
                    <div className="mt-1 text-[11.5px] text-[color:var(--glass-ink-faint)]">
                      {item.readingTime
                        ? t("readingTime", { minutes: item.readingTime })
                        : item.desc.slice(0, 80)}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-soft)]"
                    style={{ background: "var(--glass-surface)" }}
                  >
                    {item.tag}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="glass-surface flex flex-col gap-3.5 p-7">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="glass-display text-[24px] font-semibold leading-none">
            {showBundles ? t("popularDossiersTitle") : t("resourcesTitle")}
          </h2>
          <button
            type="button"
            onClick={() => router.push(showBundles ? "/mon-dossier" : "/outils")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
          >
            {t("seeAll")}
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
        {showBundles &&
          bundleList.slice(0, 4).map((bundle) => {
            const Icon = bundleIcon(bundle.lifeEventCategory);
            return (
              <button
                key={bundle.slug}
                type="button"
                onClick={() => router.push(`/d/${bundle.slug}`)}
                className="group flex items-center gap-3.5 rounded-2xl p-3 text-left outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/[0.08]"
                style={{ background: "var(--glass-surface)" }}
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
                  style={{
                    // Pastille teintée à la couleur du dossier — léger dégradé
                    // pour rester dans le langage des tuiles existantes.
                    backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${bundle.color} 78%, #fff) 0%, ${bundle.color} 100%)`,
                  }}
                >
                  <Icon className="size-5" />
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
              </button>
            );
          })}
        {!showBundles && RESOURCES.map((res) => {
          const Icon = res.Icon;
          return (
            <button
              key={res.titleKey}
              type="button"
              onClick={() => res.href && router.push(res.href)}
              className="group flex items-center gap-3.5 rounded-2xl p-3 text-left outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/[0.08]"
              style={{ background: "var(--glass-surface)" }}
            >
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ backgroundImage: RESOURCE_BG[res.variant] }}
              >
                <Icon className="size-5" />
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
