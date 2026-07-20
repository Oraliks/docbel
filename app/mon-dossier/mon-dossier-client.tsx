"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Accessibility,
  ArrowRight,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  HelpCircle,
  Layers,
  Phone,
  RotateCcw,
  Search as SearchIcon,
  SlidersHorizontal,
} from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { AccessibilityToolbar } from "@/components/docbel/accessibility-toolbar";
import { DossierWizard } from "@/components/docbel/onboarding/dossier-wizard";
import { IntentSearch } from "@/components/docbel/onboarding/intent-search";
import { Button } from "@/components/ui/button";
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
import { trackBundleEventClient } from "@/lib/bundles/analytics-client";
import { LIFE_EVENT_CATEGORIES } from "@/lib/bundles/types";
import { scoreBundleMatch } from "@/lib/bundles/vocabulary";
import type { WizardSituation } from "@/lib/dossier-wizard/config";
import type { WizardCatalog } from "@/lib/dossier-wizard/derive-results";
import type { ActiveBundleRun } from "@/lib/landing/resume";

export interface MonDossierBundle {
  slug: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  lifeEventCategory: string | null;
  itemCount: number;
  createdAt: string | null;
  popular: boolean;
  organism: string | null;
  vocabularyTags: string[];
  keywords: string[];
  synonyms: string[];
}

interface Props {
  bundles: MonDossierBundle[];
  catalog: WizardCatalog;
  activeRuns: ActiveBundleRun[];
  situations: WizardSituation[];
  /// Situation présélectionnée via `?situation=` (tuile home ou lien externe).
  /// Si elle correspond à une entrée de `situations`, le guichet (toujours
  /// ouvert) saute directement à l'étape 2 (cf. DossierWizard.initialSituation).
  /// `null`/absent = le guichet démarre à l'étape 1 (choix de situation).
  initialSituation?: string | null;
}

type Sort = "populaires" | "az" | "categories" | "recents";

const SORT_PILLS = [
  { id: "populaires", labelKey: "sortPopular" },
  { id: "az", labelKey: "sortAz" },
  { id: "categories", labelKey: "sortCategories" },
  { id: "recents", labelKey: "sortRecent" },
] as const satisfies ReadonlyArray<{ id: Sort; labelKey: string }>;

const CATEGORY_HUE: Record<string, string> = {
  emploi: "#5B46E5",
  formation: "#7C3AED",
  famille: "#ff5fa2",
  logement: "#0ea5e9",
  sante: "#10b981",
  pension: "#f59e0b",
  social: "#ff7a7a",
  independant: "#8b5cf6",
};

function bundleHref(slug: string): string {
  return `/d/${slug}`;
}

function substringHit(bundle: MonDossierBundle, query: string): boolean {
  if (!query) return false;
  if (bundle.name.toLowerCase().includes(query)) return true;
  if ((bundle.description ?? "").toLowerCase().includes(query)) return true;
  if ((bundle.organism ?? "").toLowerCase().includes(query)) return true;
  return [
    ...bundle.vocabularyTags,
    ...bundle.keywords,
    ...bundle.synonyms,
  ].some((term) => term.toLowerCase().includes(query));
}

function hueForBundle(bundle: MonDossierBundle): string {
  if (bundle.color?.trim()) return bundle.color;
  if (bundle.lifeEventCategory && CATEGORY_HUE[bundle.lifeEventCategory]) {
    return CATEGORY_HUE[bundle.lifeEventCategory];
  }
  return "var(--glass-accent-deep)";
}

function RowIconTile({ bundle }: { bundle: MonDossierBundle }) {
  const hue = hueForBundle(bundle);
  const category = bundle.lifeEventCategory
    ? LIFE_EVENT_CATEGORIES.find((item) => item.id === bundle.lifeEventCategory)
    : null;

  return (
    <span
      className="glass-icon-tile flex size-12 shrink-0 items-center justify-center rounded-2xl"
      style={
        {
          background: `color-mix(in oklab, ${hue} 18%, transparent)`,
          color: hue,
          "--tile-hue": hue,
        } as React.CSSProperties
      }
      aria-hidden
    >
      {bundle.icon ? (
        <IconDisplay value={bundle.icon} className="size-6" />
      ) : category ? (
        <span className="text-2xl leading-none">{category.emoji}</span>
      ) : (
        <Layers />
      )}
    </span>
  );
}

function AccessRow({ bundle }: { bundle: MonDossierBundle }) {
  const t = useTranslations("public.dossier");
  const subtitle =
    bundle.organism?.trim() ||
    (bundle.itemCount > 0
      ? t("docsToPrepare", { count: bundle.itemCount })
      : t("guidedDossier"));

  return (
    <Link
      href={bundleHref(bundle.slug)}
      onClick={() =>
        trackBundleEventClient("bundle_opened", {
          bundleId: bundle.slug,
          metadata: { slug: bundle.slug, from: "direct" },
        })
      }
      className="glass-interactive group flex min-h-16 items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
    >
      <RowIconTile bundle={bundle} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-snug text-[color:var(--glass-ink)]">
          {bundle.name}
        </span>
        <span className="mt-1 block text-sm text-[color:var(--glass-ink-soft)]">
          {subtitle}
        </span>
      </span>
      <ChevronRight className="shrink-0 text-[color:var(--glass-accent-deep)]" aria-hidden />
    </Link>
  );
}

function HelpRow({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: typeof HelpCircle;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-[color:var(--glass-ink)]">
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[color:var(--glass-accent-deep)]" aria-hidden />
    </>
  );
  const className =
    "glass-interactive flex min-h-14 w-full items-center gap-2 border-b border-[color:var(--glass-border)] px-3 py-2 text-left last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function ActiveRunCard({ run }: { run: ActiveBundleRun }) {
  const t = useTranslations("public.dossier");
  const completed = run.lifecycle === "completed_editable";
  const percentage = completed
    ? 100
    : run.total > 0
      ? Math.round((run.completed / run.total) * 100)
      : 0;
  const hue = run.color || "var(--glass-accent-deep)";

  return (
    <Link
      href={`${bundleHref(run.slug)}?bundleRun=${encodeURIComponent(run.runId)}&demarrer=1`}
      onClick={() =>
        trackBundleEventClient("bundle_resumed", {
          bundleId: run.slug,
          metadata: { slug: run.slug, from: "resume_local" },
        })
      }
      className="glass-interactive grid min-h-16 items-center gap-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-2.5 sm:grid-cols-[minmax(0,1.35fr)_minmax(150px,0.7fr)_auto]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)]" style={{ color: hue }} aria-hidden><FolderOpen className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[color:var(--glass-ink)]">{run.name}</span>
          <span className="mt-0.5 block text-xs text-[color:var(--glass-ink)]/65">
            {completed
              ? t("runCompletedEditable")
              : t("runProgress", { completed: run.completed, total: run.total })}
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--glass-ink)]/70">{percentage}%</span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-ink-line)]" aria-hidden>
          <span className="block h-full rounded-full" style={{ width: `${percentage}%`, background: hue }} />
        </span>
      </span>
      <span className="inline-flex items-center justify-end gap-2 text-xs font-bold text-[color:var(--glass-accent-deep)]">
          {completed ? t("reviewCompletedRun") : t("resume")}
          <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}

export function MonDossierClient({
  bundles,
  catalog,
  activeRuns,
  situations,
  initialSituation,
}: Props) {
  const t = useTranslations("public.dossier");
  const tA11y = useTranslations("public.accessibility");
  const locale = useLocale();
  // Présélection home (`?situation=`), validée contre `situations` (le query
  // param peut être arbitraire ou périmé). Recalculée à chaque rendu — sert
  // uniquement d'init pour le useState suivant (pas de setState dans un
  // effect).
  const validInitialSituation =
    initialSituation && situations.some((s) => s.value === initialSituation)
      ? initialSituation
      : null;
  // Situation à transmettre au DossierWizard (initialSituation/key) : fixée
  // une fois depuis le query param. Le guichet est toujours ouvert ; toute
  // sélection ultérieure se fait dans le wizard lui-même (step 1), sans
  // remonter jusqu'ici.
  const [presetSituation] = useState<string | null>(validInitialSituation);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("populaires");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [showAllCats, setShowAllCats] = useState(false);
  const emittedSearches = useRef<Set<string>>(new Set());
  const trimmed = search.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const categoryFiltered = useMemo(() => {
    if (activeCats.size === 0) return bundles;
    return bundles.filter(
      (bundle) =>
        bundle.lifeEventCategory && activeCats.has(bundle.lifeEventCategory),
    );
  }, [activeCats, bundles]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [] as MonDossierBundle[];
    return categoryFiltered
      .map((bundle) => {
        const score = scoreBundleMatch(search, {
          id: bundle.slug,
          slug: bundle.slug,
          name: bundle.name,
          description: bundle.description,
          vocabularyTags: bundle.vocabularyTags,
          keywords: bundle.keywords,
          synonyms: bundle.synonyms,
          organism: bundle.organism,
        }).score;
        return {
          bundle,
          score: score + (score === 0 && substringHit(bundle, trimmed) ? 1 : 0),
        };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.bundle);
  }, [categoryFiltered, isSearching, search, trimmed]);

  const sortItems = useMemo(
    () => (items: MonDossierBundle[]) => {
      const next = [...items];
      if (sort === "az") next.sort((a, b) => a.name.localeCompare(b.name, locale));
      else if (sort === "recents") {
        next.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      } else next.sort((a, b) => Number(b.popular) - Number(a.popular));
      return next;
    },
    [locale, sort],
  );

  const groups = useMemo(() => {
    const map = new Map<string, MonDossierBundle[]>();
    const uncategorized: MonDossierBundle[] = [];
    for (const bundle of categoryFiltered) {
      if (bundle.lifeEventCategory && CATEGORY_HUE[bundle.lifeEventCategory]) {
        map.set(bundle.lifeEventCategory, [
          ...(map.get(bundle.lifeEventCategory) ?? []),
          bundle,
        ]);
      } else uncategorized.push(bundle);
    }
    const ordered: Array<{
      id: string;
      label: string;
      emoji: string;
      items: MonDossierBundle[];
    }> = LIFE_EVENT_CATEGORIES.filter((category) => map.has(category.id)).map(
      (category) => ({
        id: category.id,
        label: category.label,
        emoji: category.emoji,
        items: sortItems(map.get(category.id) ?? []),
      }),
    );
    if (uncategorized.length > 0) {
      ordered.push({
        id: "_autres",
        label: t("otherDossiers"),
        emoji: "📁",
        items: sortItems(uncategorized),
      });
    }
    return ordered;
  }, [categoryFiltered, sortItems, t]);

  const availableCats = useMemo(
    () =>
      LIFE_EVENT_CATEGORIES.filter((category) =>
        bundles.some((bundle) => bundle.lifeEventCategory === category.id),
      ),
    [bundles],
  );
  const collapsed = !isSearching && !showAllCats && sort !== "categories";
  const visibleGroups = collapsed ? groups.slice(0, 3) : groups;
  const empty = isSearching ? searchResults.length === 0 : categoryFiltered.length === 0;

  function toggleCategory(id: string) {
    setActiveCats((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (!isSearching || trimmed.length < 2 || emittedSearches.current.has(trimmed)) return;
    const timer = setTimeout(() => {
      emittedSearches.current.add(trimmed);
      trackBundleEventClient(
        searchResults.length === 0 ? "search_no_result" : "search_performed",
        { metadata: { q: trimmed, results: searchResults.length } },
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [isSearching, searchResults.length, trimmed]);

  return (
    <section className="docbel-a11y-scope relative isolate flex w-full flex-col gap-4 sm:gap-5">
      <header className="grid gap-4 px-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-end" data-docbel-readable>
        <div className="flex flex-col gap-3">
          <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-2 text-sm text-[color:var(--glass-ink-soft)]" data-a11y-secondary="true">
            <Link href="/" className="font-medium hover:text-[color:var(--glass-ink)]">{t("breadcrumbHome")}</Link>
            <span aria-hidden>/</span>
            <span className="font-bold text-[color:var(--glass-ink)]">{t("breadcrumbCurrent")}</span>
          </nav>
          <h1 className="glass-display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("monDossierTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--glass-ink)]/70 sm:text-base">
            {t("monDossierIntro")}
          </p>
        </div>
        <Link href="/contact" className="glass-interactive flex items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden><HelpCircle /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[color:var(--glass-ink)]">{t("helpTitle")}</span>
            <span className="mt-1 block text-xs leading-relaxed text-[color:var(--glass-ink)]/70">{t("helpSubtitle")}</span>
          </span>
          <ChevronRight className="shrink-0 text-[color:var(--glass-accent-deep)]" aria-hidden />
        </Link>
      </header>

      {activeRuns.length > 0 && (
        <Link
          href="/mes-demarches"
          className="glass-surface flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-[color:var(--glass-pop-bg)]/40"
        >
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
            <RotateCcw className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-[color:var(--glass-ink)]">
              {t("resumeBannerTitle", { count: activeRuns.length })}
            </span>
            <span className="block truncate text-xs text-[color:var(--glass-ink-soft)]">
              {activeRuns.map((r) => r.name).join(" · ")}
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-[color:var(--glass-accent-deep)]">
            {t("resumeBannerCta")} →
          </span>
        </Link>
      )}

      <div id="guichet" className="flex flex-col gap-4 px-1" data-docbel-readable>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold leading-tight text-[color:var(--glass-ink)] sm:text-3xl">
            {t("guichetTitle")}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--glass-ink)]/70 sm:text-base">
            {t("guichetSubtitle")}
          </p>
        </div>
        <DossierWizard
          key={presetSituation ?? "none"}
          situations={situations}
          catalog={catalog}
          initialSituation={presetSituation ?? undefined}
        />
      </div>

      <section className="glass-surface flex flex-col gap-4 p-3 sm:p-5" data-docbel-readable>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden>
            <FolderOpen />
          </span>
          <div>
            <h2 className="text-xl font-bold text-[color:var(--glass-ink)]">{t("guichetBrowseAll")}</h2>
            <p className="mt-1 text-base text-[color:var(--glass-ink-soft)]">{t("directAccessSubtitle")}</p>
          </div>
        </div>

        <InputGroup className="min-h-12 rounded-2xl">
          <InputGroupAddon><SearchIcon aria-hidden /></InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchAriaLabel")}
            className="text-base"
          />
        </InputGroup>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-a11y-secondary="true">
          <ToggleGroup
            value={[sort]}
            onValueChange={(values) => {
              const selected = values.at(-1) as Sort | undefined;
              if (selected) setSort(selected);
            }}
            variant="outline"
            spacing={1}
            className="flex w-full flex-wrap sm:w-auto"
            aria-label={t("sortGroupLabel")}
          >
            {SORT_PILLS.map((pill) => (
              <ToggleGroupItem key={pill.id} value={pill.id} className="min-h-11 flex-1 px-3 text-sm sm:flex-none">
                {t(pill.labelKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button type="button" variant="outline" size="lg" className="min-h-11" aria-pressed={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>
            <SlidersHorizontal data-icon="inline-start" aria-hidden />
            {t("filters")}{activeCats.size > 0 ? ` (${activeCats.size})` : ""}
          </Button>
        </div>

        {filtersOpen && availableCats.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[color:var(--glass-border)] p-3" data-a11y-secondary="true">
            {availableCats.map((category) => (
              <Button
                key={category.id}
                type="button"
                variant={activeCats.has(category.id) ? "default" : "outline"}
                size="lg"
                className="min-h-11"
                aria-pressed={activeCats.has(category.id)}
                onClick={() => toggleCategory(category.id)}
              >
                <span aria-hidden>{category.emoji}</span>{category.label}
              </Button>
            ))}
            {activeCats.size > 0 ? (
              <Button type="button" variant="ghost" size="lg" className="min-h-11" onClick={() => setActiveCats(new Set())}>{t("reset")}</Button>
            ) : null}
          </div>
        ) : null}

        {empty ? (
          <div className="flex flex-col gap-4">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><SearchIcon aria-hidden /></EmptyMedia>
                <EmptyTitle className="text-lg">{bundles.length === 0 ? t("emptyNoneTitle") : t("emptyNoMatchTitle")}</EmptyTitle>
                <EmptyDescription className="text-base">{bundles.length === 0 ? t("emptyNoneBody") : t("emptyNoMatchBody")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
            <div className="flex flex-col gap-3 border-t border-[color:var(--glass-border)] pt-4">
              <h3 className="text-sm font-bold text-[color:var(--glass-ink)]">
                {t("intentFallbackTitle")}
              </h3>
              <IntentSearch />
            </div>
          </div>
        ) : isSearching ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {searchResults.map((bundle) => <AccessRow key={bundle.slug} bundle={bundle} />)}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {visibleGroups.map((group) => (
              <section key={group.id} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-[color:var(--glass-ink)]">
                  <span aria-hidden>{group.emoji}</span>{group.label}
                  <span className="ml-auto rounded-full bg-[color:var(--glass-pop-bg)] px-3 py-1 text-sm text-[color:var(--glass-accent-deep)]">{group.items.length}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.items.map((bundle) => <AccessRow key={bundle.slug} bundle={bundle} />)}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isSearching && groups.length > 3 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 w-full"
            onClick={() => {
              setShowAllCats((shown) => !shown);
              if (!showAllCats) setSort("categories");
            }}
          >
            {collapsed ? t("seeAllCategories", { count: groups.length }) : t("seeLess")}
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        ) : null}
      </section>

      <section className="glass-surface grid overflow-hidden rounded-2xl border border-[color:var(--glass-border)] sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,1fr)]" aria-labelledby="help-title" data-a11y-secondary="true">
        <div className="flex items-center gap-2 border-b border-[color:var(--glass-border)] px-3 py-3 sm:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-r">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]" aria-hidden><HelpCircle className="size-4" /></span>
          <div>
            <h2 id="help-title" className="text-sm font-bold text-[color:var(--glass-ink)]">{t("helpTitle")}</h2>
            <p className="text-xs text-[color:var(--glass-ink)]/65">{t("helpSubtitle")}</p>
          </div>
        </div>
        <HelpRow icon={HelpCircle} label={t("helpFindRightDossier")} href="#guichet" />
        <HelpRow icon={FileQuestion} label={t("helpCannotFind")} href="/contact" />
        <HelpRow icon={RotateCcw} label={t("helpWhereIsRequest")} href="/mes-demarches" />
        <HelpRow icon={Phone} label={t("helpContactSupport")} href="/contact" />
      </section>

      <details className="group glass-surface rounded-xl px-3 py-2" data-a11y-secondary="true">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-[color:var(--glass-ink)]">
          <Accessibility className="size-4 text-[color:var(--glass-accent-deep)]" aria-hidden />
          {tA11y("title")}
          <ChevronRight className="ml-auto size-4 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className="mt-2"><AccessibilityToolbar /></div>
      </details>
    </section>
  );
}
