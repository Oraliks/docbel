"use client";

/**
 * Écran d'explication d'un dossier (« journey ») — style « light premium
 * pastel » (brief Oraliks), version resserrée : fond très clair en dégradé
 * doux, cartes blanches translucides à bordure lavande, ombres légères, titres
 * violet foncé, actions violet moyen, rose pâle réservé à l'alerte. Grand titre
 * éditorial serif. Espacements réduits, cartes plus compactes, sans CTA
 * intermédiaire (le seul appel à l'action est le bandeau final).
 *
 * Contenu 100 % piloté par la `DossierDefinition` ; `BundleRunner` inchangé.
 */

import { type ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Coins,
  FileCheck2,
  FilePlus2,
  GraduationCap,
  Info,
  UserRoundCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { BundleRunner } from "./bundle-runner";
import { JourneyHeroIllustration } from "./journey-hero-illustration";
import type { DossierJourneyStep, JourneyStepIcon } from "@/lib/dossiers/types";
import type { JourneyWarning, JourneyDocument } from "@/lib/dossiers/journey";

type DossierJourneyIntroProps = {
  journey: DossierJourneyStep[];
  warnings: JourneyWarning[];
  documents: JourneyDocument[];
  ctaLabel: string;
  ctaLabelKey?: string;
} & ComponentProps<typeof BundleRunner>;

/** Icônes linéaires (lucide) des étapes. */
const STEP_ICON: Record<JourneyStepIcon, LucideIcon> = {
  "user-check": UserRoundCheck,
  calendar: CalendarClock,
  "file-check": FileCheck2,
  wallet: Wallet,
};

/** Icône « à savoir » : heuristique sur le titre, repli sur la sévérité. */
function warningIcon(title: string, severity: JourneyWarning["severity"]): LucideIcon {
  const t = title.toLowerCase();
  if (/montant|€|alloc|brut/.test(t)) return Coins;
  if (/alternance|formation|dipl/.test(t)) return GraduationCap;
  if (/stage|jour|mois|délai|delai/.test(t)) return CalendarDays;
  if (severity === "critical") return AlertTriangle;
  return Info;
}

/** Carte blanche translucide, bordure lavande fine, ombre douce, coins arrondis. */
const CARD =
  "rounded-3xl border border-[color:color-mix(in_oklab,var(--glass-accent-a)_38%,transparent)] bg-[color:var(--glass-surface-strong)] shadow-[0_10px_34px_-18px_rgba(91,70,229,0.28)] backdrop-blur-xl";

export function DossierJourneyIntro({
  journey,
  warnings,
  documents: _documents,
  ctaLabel,
  ctaLabelKey,
  ...runnerProps
}: DossierJourneyIntroProps) {
  const t = useTranslations("public.dossierContent");
  const td = useTranslations("public.dossier");
  const [started, setStarted] = useState(false);

  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    const k = key as Parameters<typeof t>[0];
    return t.has(k) ? t(k) : fallback;
  };

  if (started) {
    return (
      <div className="outils-rise">
        <BundleRunner {...runnerProps} />
      </div>
    );
  }

  const steps = [...journey].sort((a, b) => a.order - b.order);
  const start = () => setStarted(true);
  const cta = resolve(ctaLabelKey, ctaLabel);

  return (
    <section className="relative flex w-full flex-col gap-8">
      {/* Décor pastel très doux (blanc → lavande → rose → beige) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -right-24 -top-16 size-[380px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-a) 24%, transparent) 0%, transparent 70%)" }}
        />
        <div
          className="absolute left-1/3 top-1/2 size-[320px] rounded-full opacity-55 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-c) 18%, transparent) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-16 right-1/4 size-[300px] rounded-full opacity-45 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-d) 20%, transparent) 0%, transparent 70%)" }}
        />
      </div>

      {/* ══ Hero — titre éditorial serif + illustration, sans carte ══ */}
      <header className="grid items-center gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="flex flex-col">
          <h1
            className="glass-display text-[34px] font-semibold leading-[1.03] text-[color:var(--glass-ink)] sm:text-[46px]"
            style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0", fontFeatureSettings: "'swsh' 0, 'salt' 0" }}
          >
            {runnerProps.bundle.name}
          </h1>
          {runnerProps.bundle.description ? (
            <p className="mt-3 max-w-[420px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
              {runnerProps.bundle.description}
            </p>
          ) : null}
        </div>
        <JourneyHeroIllustration className="h-auto w-full max-w-[420px] justify-self-center lg:justify-self-end" />
      </header>

      {/* ══ 4 cartes d'étapes (compactes, informatives) ══ */}
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = STEP_ICON[step.icon];
          return (
            <li key={step.order} className="relative outils-rise" style={{ animationDelay: `${i * 90}ms` }}>
              {i < steps.length - 1 ? (
                <span
                  className="absolute -right-3.5 top-1/2 z-10 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--glass-accent-a)_45%,transparent)] bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)] shadow-[0_5px_14px_-6px_rgba(91,70,229,0.4)] backdrop-blur lg:flex"
                  aria-hidden
                >
                  <ChevronRight className="size-3.5" />
                </span>
              ) : null}
              <div className={`${CARD} relative flex h-full flex-col items-center gap-2 p-5 pt-6 text-center`}>
                <span className="absolute left-4 top-4 flex size-7 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--glass-accent-a)_28%,transparent)] text-[12px] font-bold text-[color:var(--glass-accent-deep)]">
                  {step.order}
                </span>
                <span
                  className="flex size-12 items-center justify-center rounded-2xl text-[color:var(--glass-accent-deep)]"
                  style={{ background: "color-mix(in oklab, var(--glass-accent-a) 16%, transparent)" }}
                >
                  <Icon className="size-6" strokeWidth={1.7} />
                </span>
                <span className="text-[14.5px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                  {resolve(step.titleKey, step.title)}
                </span>
                <span className="text-[12px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                  {resolve(step.bodyKey, step.body)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ══ À savoir avant de commencer ══ */}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="glass-display w-fit text-[20px] font-semibold text-[color:var(--glass-ink)]">
            {td("journeyConditionsTitle")}
            <span className="mt-1.5 block h-[3px] w-12 rounded-full bg-[color:var(--glass-accent-deep)]" />
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {warnings.map((w, i) => {
              const title = resolve(w.titleKey, w.title);
              const message = resolve(w.messageKey, w.message);
              const alert = w.severity === "critical";
              const WIcon = warningIcon(title, w.severity);
              return (
                <div
                  key={w.titleKey ?? w.title}
                  className={`${CARD} outils-rise flex flex-col gap-2 p-5`}
                  style={{
                    animationDelay: `${120 + i * 80}ms`,
                    ...(alert
                      ? { background: "color-mix(in oklab, var(--glass-accent-c) 9%, var(--glass-surface-strong))" }
                      : {}),
                  }}
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{
                      background: alert
                        ? "color-mix(in oklab, var(--glass-accent-c) 20%, transparent)"
                        : "color-mix(in oklab, var(--glass-accent-a) 20%, transparent)",
                      color: alert ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)",
                    }}
                    aria-hidden
                  >
                    <WIcon className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <p className="text-[13.5px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                    {title}
                  </p>
                  <p className="text-[12px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                    {message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ══ Bandeau CTA final — le SEUL appel à l'action ══ */}
      <div className={`${CARD} outils-rise flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7`}>
        <div className="flex items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-[color:var(--glass-accent-deep)]"
            style={{ background: "color-mix(in oklab, var(--glass-accent-a) 18%, transparent)" }}
            aria-hidden
          >
            <FilePlus2 className="size-6" strokeWidth={1.7} />
          </span>
          <div>
            <p className="glass-display text-[20px] font-semibold leading-snug text-[color:var(--glass-ink)]">
              {td("journeyBannerTitle")}
            </p>
            <p className="mt-1 max-w-md text-[13px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {td("journeyBannerSubtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          className="glass-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-bold shadow-[0_12px_32px_-10px_rgba(91,70,229,0.55)]"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
