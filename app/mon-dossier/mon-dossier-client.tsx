"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  HelpCircle,
  Phone,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { DossierWizard } from "@/components/docbel/onboarding/dossier-wizard";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { trackBundleEventClient } from "@/lib/bundles/analytics-client";
import { LIFE_EVENT_CATEGORIES } from "@/lib/bundles/types";
import type { WizardSituation } from "@/lib/dossier-wizard/config";
import type { WizardCatalog } from "@/lib/dossier-wizard/derive-results";
import type { ActiveBundleRun } from "@/lib/landing/resume";
import { cn } from "@/lib/utils";

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
  initialSituation?: string | null;
}

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
      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      style={{ color: hue } as React.CSSProperties}
      aria-hidden
    >
      {bundle.icon ? (
        <IconDisplay value={bundle.icon} className="size-5" />
      ) : category ? (
        <span className="text-xl leading-none">{category.emoji}</span>
      ) : (
        <FolderOpen className="size-5" />
      )}
    </span>
  );
}

function bundleSubtitle(
  bundle: MonDossierBundle,
  t: ReturnType<typeof useTranslations<"public.dossier">>,
): string {
  return (
    bundle.organism?.trim() ||
    (bundle.itemCount > 0
      ? t("docsToPrepare", { count: bundle.itemCount })
      : t("guidedDossier"))
  );
}

function AccessTile({ bundle }: { bundle: MonDossierBundle }) {
  const t = useTranslations("public.dossier");

  return (
    <Link
      href={bundleHref(bundle.slug)}
      onClick={() =>
        trackBundleEventClient("bundle_opened", {
          bundleId: bundle.slug,
          metadata: { slug: bundle.slug, from: "direct" },
        })
      }
      className="glass-interactive group flex min-h-[88px] items-center gap-3 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-3 outline-none"
    >
      <RowIconTile bundle={bundle} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-foreground">
          {bundle.name}
        </span>
        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
          {bundleSubtitle(bundle, t)}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        aria-hidden
      />
    </Link>
  );
}

function AccessRow({ bundle }: { bundle: MonDossierBundle }) {
  const t = useTranslations("public.dossier");

  return (
    <Link
      href={bundleHref(bundle.slug)}
      onClick={() =>
        trackBundleEventClient("bundle_opened", {
          bundleId: bundle.slug,
          metadata: { slug: bundle.slug, from: "direct" },
        })
      }
      className="group flex min-h-16 items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <RowIconTile bundle={bundle} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-foreground">
          {bundle.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {bundleSubtitle(bundle, t)}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        aria-hidden
      />
    </Link>
  );
}

function HelpLink({
  icon: Icon,
  label,
  description,
  href,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass-interactive group flex min-h-[72px] items-center gap-3 rounded-xl px-2.5 py-2 outline-none"
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug text-foreground">
          {label}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        aria-hidden
      />
    </Link>
  );
}

function ActiveDossierCard({
  run,
  runCount,
}: {
  run: ActiveBundleRun;
  runCount: number;
}) {
  const t = useTranslations("public.dossier");
  const completed = run.lifecycle === "completed_editable";
  const percentage = completed
    ? 100
    : run.total > 0
      ? Math.min(100, Math.round((run.completed / run.total) * 100))
      : 0;
  const progressLabel = completed
    ? t("runCompletedEditable")
    : t("runProgress", { completed: run.completed, total: run.total });
  const resumeHref = `/d/${encodeURIComponent(run.slug)}?bundleRun=${encodeURIComponent(run.runId)}&demarrer=1`;

  return (
    <Card size="sm" className="h-full rounded-2xl">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-primary">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
            {t("ongoingDossier")}
          </span>
        </div>
        <CardTitle className="pr-14 text-base font-semibold leading-snug">
          {run.name}
        </CardTitle>
        <CardDescription>{progressLabel}</CardDescription>
        <CardAction>
          <Badge variant={completed ? "secondary" : "outline"}>
            {completed ? t("demandeStatusComplete") : `${run.completed}/${run.total}`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress
          value={percentage}
          aria-label={progressLabel}
          className="docbel-progress-feedback [&_[data-slot=progress-indicator]]:bg-[color:var(--glass-accent-deep)]"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            render={<Link href={resumeHref} />}
            size="sm"
            className="flex-1"
          >
            {completed ? t("reviewCompletedRun") : t("resumeBannerCta")}
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
          </Button>
          {runCount > 1 ? (
            <Button
              render={<Link href="/mes-demarches" />}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              {t("seeAllDemarches")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
  const validInitialSituation =
    initialSituation && situations.some((situation) => situation.value === initialSituation)
      ? initialSituation
      : null;
  const [presetSituation] = useState<string | null>(validInitialSituation);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const groups = useMemo(() => {
    const grouped = new Map<string, MonDossierBundle[]>();
    const uncategorized: MonDossierBundle[] = [];

    for (const bundle of bundles) {
      if (bundle.lifeEventCategory) {
        grouped.set(bundle.lifeEventCategory, [
          ...(grouped.get(bundle.lifeEventCategory) ?? []),
          bundle,
        ]);
      } else {
        uncategorized.push(bundle);
      }
    }

    const ordered: Array<{
      id: string;
      label: string;
      emoji: string;
      items: MonDossierBundle[];
    }> = LIFE_EVENT_CATEGORIES.filter((category) => grouped.has(category.id)).map(
      (category) => ({
        id: category.id,
        label: category.label,
        emoji: category.emoji,
        items: [...(grouped.get(category.id) ?? [])].sort(
          (left, right) => Number(right.popular) - Number(left.popular),
        ),
      }),
    );

    if (uncategorized.length > 0) {
      ordered.push({
        id: "_autres",
        label: t("otherDossiers"),
        emoji: "📁",
        items: uncategorized,
      });
    }

    return ordered;
  }, [bundles, t]);

  const directBundles = useMemo(
    () =>
      [...bundles]
        .sort((left, right) => Number(right.popular) - Number(left.popular))
        .slice(0, 6),
    [bundles],
  );
  const activeRun = activeRuns[0] ?? null;

  return (
    <section
      className="docbel-a11y-scope relative isolate flex w-full flex-col gap-5 sm:gap-6"
      data-docbel-readable
    >
      <header
        className={cn(
          "grid items-stretch gap-5 px-1",
          activeRun && "lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]",
        )}
      >
        <div className="flex flex-col justify-center gap-3">
          <nav
            aria-label={t("breadcrumbLabel")}
            className="flex items-center gap-2 text-xs text-muted-foreground"
            data-a11y-secondary="true"
          >
            <Link href="/" className="font-medium transition-colors hover:text-foreground">
              {t("breadcrumbHome")}
            </Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-foreground">
              {t("breadcrumbMonDossier")}
            </span>
          </nav>
          <h1 className="glass-display text-4xl font-semibold leading-[1.05] sm:text-5xl">
            {t.rich("monDossierTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("monDossierIntro")}
          </p>
        </div>

        {activeRun ? (
          <ActiveDossierCard run={activeRun} runCount={activeRuns.length} />
        ) : null}
      </header>

      <DossierWizard
        key={presetSituation ?? "none"}
        hideHeader
        situations={situations}
        catalog={catalog}
        initialSituation={presetSituation ?? undefined}
      />

      {bundles.length > 0 ? (
        <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
          <Card size="sm" className="rounded-2xl">
            <CardHeader>
              <CardTitle>
                <h2 className="glass-display text-xl font-semibold sm:text-2xl">
                  {t("directAccessTitle")}
                </h2>
              </CardTitle>
              <CardDescription>{t("directAccessSubtitle")}</CardDescription>
              <CardAction>
                <CollapsibleTrigger
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "text-primary",
                  )}
                >
                  {catalogOpen
                    ? t("seeLess")
                    : t("seeAllCategories", { count: groups.length })}
                  <ChevronDown
                    data-icon="inline-end"
                    className={cn("transition-transform", catalogOpen && "rotate-180")}
                    aria-hidden
                  />
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {directBundles.map((bundle) => (
                <AccessTile key={bundle.slug} bundle={bundle} />
              ))}
            </CardContent>
            <CollapsibleContent>
              <Separator />
              <CardContent className="grid gap-6 pt-4 lg:grid-cols-2">
                {groups.map((group) => (
                  <section
                    key={group.id}
                    className="flex flex-col"
                    aria-labelledby={`catalog-${group.id}`}
                  >
                    <div className="flex items-center gap-2 px-2 pb-2">
                      <span aria-hidden>{group.emoji}</span>
                      <h3
                        id={`catalog-${group.id}`}
                        className="text-sm font-semibold text-foreground"
                      >
                        {group.label}
                      </h3>
                      <Badge variant="secondary" className="ms-auto">
                        {group.items.length}
                      </Badge>
                    </div>
                    <Separator />
                    {group.items.map((bundle, index) => (
                      <div key={bundle.slug}>
                        <AccessRow bundle={bundle} />
                        {index < group.items.length - 1 ? <Separator /> : null}
                      </div>
                    ))}
                  </section>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ) : null}

      <Card size="sm" className="rounded-2xl" data-a11y-secondary="true">
        <CardHeader>
          <CardTitle>
            <h2 className="glass-display text-xl font-semibold sm:text-2xl">
              {t("helpTitle")}
            </h2>
          </CardTitle>
          <CardDescription>{t("helpSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
          <HelpLink
            icon={FileQuestion}
            label={t("helpFindRightDossier")}
            description={t("helpFindRightDossierSub")}
            href="#assistant-heading"
          />
          <HelpLink
            icon={HelpCircle}
            label={t("helpCannotFind")}
            description={t("helpCannotFindSub")}
            href="/contact"
          />
          <HelpLink
            icon={RotateCcw}
            label={t("helpWhereIsRequest")}
            description={t("helpWhereIsRequestSub")}
            href="/mes-demarches"
          />
          <HelpLink
            icon={Phone}
            label={t("helpContactSupport")}
            description={t("helpContactSupportSub")}
            href="/contact"
          />
        </CardContent>
      </Card>
    </section>
  );
}
