"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  HelpCircle,
  Phone,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { AccessibilityToolbar } from "@/components/docbel/accessibility-toolbar";
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
      className="group flex min-h-16 items-center gap-3 rounded-lg px-2 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <RowIconTile bundle={bundle} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-foreground">
          {bundle.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function HelpLink({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof HelpCircle;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary" aria-hidden>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
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

  return (
    <section className="docbel-a11y-scope relative isolate flex w-full flex-col gap-8 sm:gap-10" data-docbel-readable>
      <header className="flex flex-col gap-4 px-1">
        <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-2 text-sm text-muted-foreground" data-a11y-secondary="true">
          <Link href="/" className="font-medium transition-colors hover:text-foreground">
            {t("breadcrumbHome")}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-foreground">{t("breadcrumbCurrent")}</span>
        </nav>
        <div className="flex max-w-3xl flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            <Sparkles data-icon="inline-start" aria-hidden />
            {t("wizardAssistantTitle")}
          </Badge>
          <h1 className="glass-display text-4xl font-semibold leading-tight sm:text-5xl">
            {t.rich("guichetTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("monDossierIntro")}
          </p>
        </div>
      </header>

      {activeRuns.length > 0 ? (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="size-4 text-primary" aria-hidden />
              {t("resumeBannerTitle", { count: activeRuns.length })}
            </CardTitle>
            <CardDescription className="truncate">
              {activeRuns.map((run) => run.name).join(" · ")}
            </CardDescription>
            <CardAction>
              <Button render={<Link href="/mes-demarches" />} variant="outline" size="lg" className="min-h-11">
                {t("resumeBannerCta")}
                <ChevronRight data-icon="inline-end" aria-hidden />
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      ) : null}

      <section id="guichet" className="flex flex-col gap-4" aria-labelledby="assistant-title">
        <div className="flex max-w-2xl flex-col gap-1 px-1">
          <h2 id="assistant-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("wizardAssistantTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("wizardAssistantSubtitle")}
          </p>
        </div>
        <DossierWizard
          key={presetSituation ?? "none"}
          hideHeader
          situations={situations}
          catalog={catalog}
          initialSituation={presetSituation ?? undefined}
        />
      </section>

      {bundles.length > 0 ? (
        <Collapsible open={catalogOpen} onOpenChange={setCatalogOpen}>
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="size-4 text-primary" aria-hidden />
                {t("guichetBrowseAll")}
              </CardTitle>
              <CardDescription>{t("directAccessSubtitle")}</CardDescription>
              <CardAction>
                <CollapsibleTrigger
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
                >
                  {catalogOpen ? t("seeLess") : t("directAccessTitle")}
                  <ChevronDown
                    data-icon="inline-end"
                    className={cn("transition-transform", catalogOpen && "rotate-180")}
                    aria-hidden
                  />
                </CollapsibleTrigger>
              </CardAction>
            </CardHeader>
            <CollapsibleContent>
              <Separator />
              <CardContent className="grid gap-6 pt-4 lg:grid-cols-2">
                {groups.map((group) => (
                  <section key={group.id} className="flex flex-col" aria-labelledby={`catalog-${group.id}`}>
                    <div className="flex items-center gap-2 px-2 pb-2">
                      <span aria-hidden>{group.emoji}</span>
                      <h3 id={`catalog-${group.id}`} className="text-sm font-semibold text-foreground">
                        {group.label}
                      </h3>
                      <Badge variant="secondary" className="ms-auto">{group.items.length}</Badge>
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

      <Card size="sm" data-a11y-secondary="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary" aria-hidden />
            {t("helpTitle")}
          </CardTitle>
          <CardDescription>{t("helpSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-1 sm:grid-cols-3">
            <HelpLink icon={FileQuestion} label={t("helpCannotFind")} href="/contact" />
            <HelpLink icon={RotateCcw} label={t("helpWhereIsRequest")} href="/mes-demarches" />
            <HelpLink icon={Phone} label={t("helpContactSupport")} href="/contact" />
          </div>
          <Separator />
          <Collapsible>
            <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50">
              <Accessibility className="size-4 text-primary" aria-hidden />
              {tA11y("title")}
              <ChevronDown className="ms-auto size-4 text-muted-foreground transition-transform in-data-[state=open]:rotate-180" aria-hidden />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <AccessibilityToolbar />
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </section>
  );
}
