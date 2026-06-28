/// Page hub publique « Chômage » — point d'entrée unique des fonctionnalités
/// chômage côté citoyen. N'écrit (presque) aucun nouveau composant : elle
/// ASSEMBLE l'existant (orientation, estimation, calculateur) et renvoie vers
/// les ressources (réforme 2026, barèmes, dossiers).
///
/// Server Component `force-dynamic` (comme l'accueil / mon-dossier) car elle
/// lit les dossiers en DB. Toutes les requêtes sont fail-soft (`.catch(() =>
/// [])`) : une DB Neon froide ne doit jamais renvoyer un 500 sur une route
/// publique. Aucun lien vers `lookup-onem` (gated partenaire/admin).

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, ScrollText, Table2 } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import { WizardTeaser } from "@/components/docbel/landing/wizard-teaser";
import { SimulatorCard } from "@/components/docbel/landing/simulator-card";
import { CalcChomage } from "@/components/docbel/calculators/calc-chomage";

export const dynamic = "force-dynamic";

// Dossiers chômage mis en avant sur le hub (slugs des modules `lib/dossiers`).
// On ne montre que les démarches réellement chômage, pas tout le catalogue.
const CHOMAGE_BUNDLE_SLUGS = [
  "chomage-complet",
  "chomage-temporaire",
  "chomage-frontalier",
  "allocations-insertion",
  "prepension",
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.landing");
  return {
    title: t("chomageHubMetaTitle"),
    description: t("chomageHubMetaDesc"),
  };
}

export default async function ChomageHubPage() {
  const [t, locale] = await Promise.all([
    getTranslations("public.landing"),
    getLocale(),
  ]);

  // Dossiers chômage actifs — fail-soft : DB indisponible → rangée masquée.
  const bundleRows = await prisma.documentBundle
    .findMany({
      where: { active: true, slug: { in: CHOMAGE_BUNDLE_SLUGS } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, color: true },
    })
    .catch(() => []);
  const bundles = await localizeRecords(
    "DocumentBundle",
    bundleRows,
    ["name"],
    locale,
  );

  return (
    <section className="relative isolate mx-auto flex max-w-5xl flex-col gap-8 py-8">
      <header className="flex flex-col gap-3 px-1">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1 text-[11.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          <CalendarClock className="size-3.5" aria-hidden /> {t("chomageHubBadge")}
        </p>
        <h1 className="glass-display text-[34px] font-semibold leading-[1.06] sm:text-[42px]">
          {t.rich("chomageHubTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t("chomageHubIntro")}
        </p>
      </header>

      {/* 1. Orientation — réutilise le teaser du wizard de l'accueil. */}
      <WizardTeaser />

      {/* 2 + 3. Estimation rapide ⇄ calculateur complet, côte à côte. */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          <h2 className="glass-display text-[20px] font-semibold leading-snug">
            {t("chomageHubEstimateTitle")}
          </h2>
          <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {t("chomageHubEstimateDesc")}
          </p>
          <SimulatorCard />
        </div>

        <div className="glass-surface flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="glass-display text-[20px] font-semibold leading-snug">
            {t("chomageHubCalcTitle")}
          </h2>
          <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {t("chomageHubCalcDesc")}
          </p>
          <CalcChomage accent="var(--glass-accent-deep)" />
        </div>
      </div>

      {/* 4. Ressources : réforme 2026 + barèmes officiels. */}
      <div className="flex flex-col gap-3">
        <h2 className="glass-display text-[20px] font-semibold leading-snug px-1">
          {t("chomageHubResourcesTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/reforme-chomage-2026"
            className="glass-surface glass-interactive group flex items-start gap-3 p-5"
          >
            <span
              className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
              aria-hidden
            >
              <ScrollText className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {t("chomageHubReformeCardTitle")}
                <ArrowRight
                  className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden
                />
              </span>
              <span className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                {t("chomageHubReformeCardDesc")}
              </span>
            </span>
          </Link>

          <Link
            href="/outils/bareme-chomage"
            className="glass-surface glass-interactive group flex items-start gap-3 p-5"
          >
            <span
              className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
              aria-hidden
            >
              <Table2 className="size-4" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {t("chomageHubBaremeCardTitle")}
                <ArrowRight
                  className="size-3.5 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                  aria-hidden
                />
              </span>
              <span className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                {t("chomageHubBaremeCardDesc")}
              </span>
            </span>
          </Link>
        </div>
      </div>

      {/* 5. Dossiers chômage (fail-soft : masqué si vide). */}
      {bundles.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2 px-1">
            <div className="flex flex-col gap-0.5">
              <h2 className="glass-display text-[20px] font-semibold leading-snug">
                {t("chomageHubDossiersTitle")}
              </h2>
              <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
                {t("chomageHubDossiersDesc")}
              </p>
            </div>
            <Link
              href="/mon-dossier"
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
            >
              {t("chomageHubDossiersCta")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle) => {
              const hue = bundle.color ?? "var(--glass-accent-deep)";
              return (
                <Link
                  key={bundle.id}
                  href="/mon-dossier"
                  className="glass-surface glass-interactive group flex items-center gap-3 p-4"
                >
                  <span
                    className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in oklab, ${hue} 16%, transparent)`,
                      color: hue,
                      "--tile-hue": hue,
                    } as React.CSSProperties}
                    aria-hidden
                  >
                    <FileText className="size-4" />
                  </span>
                  <span className="flex-1 text-[13px] font-bold leading-snug tracking-tight text-[color:var(--glass-ink)]">
                    {bundle.name}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
