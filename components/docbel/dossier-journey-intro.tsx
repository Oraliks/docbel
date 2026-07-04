"use client";

/**
 * Écran d'explication d'un dossier (« journey ») — style « light premium
 * pastel » (brief Oraliks) : fond très clair en dégradé doux, cartes blanches
 * translucides à bordure lavande, ombres légères, titres violet foncé, actions
 * violet moyen, rose pâle réservé à l'alerte. Grand titre éditorial serif.
 *
 * Structure aérée : hero SANS carte (titre + description + illustration) →
 * 4 grandes cartes d'étapes reliées par des pastilles fléchées → grille
 * « À savoir » → bandeau CTA. Contenu 100 % piloté par la `DossierDefinition` ;
 * `BundleRunner` inchangé. Tous les CTA démarrent le questionnaire.
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

/** Icônes linéaires (lucide) des étapes — cohérentes avec le catalogue. */
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
  "rounded-[28px] border border-[color:color-mix(in_oklab,var(--glass-accent-a)_38%,transparent)] bg-[color:var(--glass-surface-strong)] shadow-[0_14px_46px_-18px_rgba(91,70,229,0.30)] backdrop-blur-xl";

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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

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
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <section className="relative flex w-full flex-col gap-12 pb-6">
      {/* Décor pastel très doux (blanc → lavande → rose → beige) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -right-24 -top-24 size-[420px] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-a) 26%, transparent) 0%, transparent 70%)" }}
        />
        <div
          className="absolute left-1/3 top-1/2 size-[360px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-c) 20%, transparent) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 right-1/4 size-[340px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--glass-accent-d) 22%, transparent) 0%, transparent 70%)" }}
        />
      </div>

      {/* ══ Hero — titre éditorial serif + illustration, sans carte ══ */}
      <header className="grid items-center gap-8 pt-2 lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col">
          <h1 className="glass-display text-[38px] font-semibold leading-[1.04] text-[color:var(--glass-ink)] sm:text-[52px]">
            {runnerProps.bundle.name}
          </h1>
          {runnerProps.bundle.description ? (
            <p className="mt-5 max-w-[440px] text-[15px] leading-[1.65] text-[color:var(--glass-ink-soft)]">
              {runnerProps.bundle.description}
            </p>
          ) : null}
        </div>
        <JourneyHeroIllustration className="h-auto w-full max-w-[560px] justify-self-center lg:justify-self-end" />
      </header>

      {/* ══ 4 cartes d'étapes ══ */}
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const Icon = STEP_ICON[step.icon];
          return (
            <li key={step.order} className="relative outils-rise" style={{ animationDelay: `${i * 90}ms` }}>
              {/* Pastille fléchée entre les cartes (parcours guidé) */}
              {i < steps.length - 1 ? (
                <span
                  className="absolute -right-4 top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--glass-accent-a)_45%,transparent)] bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)] shadow-[0_6px_18px_-6px_rgba(91,70,229,0.4)] backdrop-blur lg:flex"
                  aria-hidden
                >
                  <ChevronRight className="size-4" />
                </span>
              ) : null}
              <div className={`${CARD} group flex h-full flex-col items-center gap-3.5 p-7 pt-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_60px_-18px_rgba(91,70,229,0.42)]`}>
                {/* Numéro — pastille lavande, coin haut-gauche */}
                <span className="absolute left-6 top-6 flex size-8 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--glass-accent-a)_28%,transparent)] text-[13px] font-bold text-[color:var(--glass-accent-deep)]">
                  {step.order}
                </span>
                {/* Icône linéaire violette dans un halo doux */}
                <span
                  className="mt-1 flex size-16 items-center justify-center rounded-2xl text-[color:var(--glass-accent-deep)] transition-transform duration-300 group-hover:scale-105"
                  style={{ background: "color-mix(in oklab, var(--glass-accent-a) 16%, transparent)" }}
                >
                  <Icon className="size-7" strokeWidth={1.7} />
                </span>
                <span className="text-[15.5px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                  {resolve(step.titleKey, step.title)}
                </span>
                <span className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                  {resolve(step.bodyKey, step.body)}
                </span>
                <button
                  type="button"
                  onClick={start}
                  className="glass-interactive mt-auto inline-flex items-center gap-1.5 rounded-full bg-[color:color-mix(in_oklab,var(--glass-accent-a)_16%,transparent)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--glass-accent-deep)_16%,transparent)]"
                >
                  {td("journeyStepCta")}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ══ À savoir avant de commencer ══ */}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-6">
          <h2 className="glass-display w-fit text-[22px] font-semibold text-[color:var(--glass-ink)]">
            {td("journeyConditionsTitle")}
            <span className="mt-2 block h-[3px] w-14 rounded-full bg-[color:var(--glass-accent-deep)]" />
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {warnings.map((w, i) => {
              const title = resolve(w.titleKey, w.title);
              const message = resolve(w.messageKey, w.message);
              const alert = w.severity === "critical";
              const WIcon = warningIcon(title, w.severity);
              const isOpen = expanded.has(i);
              return (
                <div
                  key={w.titleKey ?? w.title}
                  className={`${CARD} outils-rise flex flex-col gap-3 p-6`}
                  style={{
                    animationDelay: `${120 + i * 80}ms`,
                    // Teinte rose très pâle uniquement pour l'alerte douce.
                    ...(alert
                      ? { background: "color-mix(in oklab, var(--glass-accent-c) 9%, var(--glass-surface-strong))" }
                      : {}),
                  }}
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-2xl"
                    style={{
                      background: alert
                        ? "color-mix(in oklab, var(--glass-accent-c) 20%, transparent)"
                        : "color-mix(in oklab, var(--glass-accent-a) 20%, transparent)",
                      color: alert ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)",
                    }}
                    aria-hidden
                  >
                    <WIcon className="size-5" strokeWidth={1.8} />
                  </span>
                  <p className="text-[14px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                    {title}
                  </p>
                  <p className={`text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)] ${isOpen ? "" : "line-clamp-3"}`}>
                    {message}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="mt-auto inline-flex w-fit items-center gap-1 pt-0.5 text-[12px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? td("journeyReadLess") : td("journeyReadMore")}
                    <ArrowRight className={`size-3.5 transition-transform ${isOpen ? "-rotate-90" : ""}`} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ══ Bandeau CTA final ══ */}
      <div className={`${CARD} outils-rise flex flex-col items-start gap-6 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9`}>
        <div className="flex items-center gap-5">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-3xl text-[color:var(--glass-accent-deep)]"
            style={{ background: "color-mix(in oklab, var(--glass-accent-a) 18%, transparent)" }}
            aria-hidden
          >
            <FilePlus2 className="size-7" strokeWidth={1.7} />
          </span>
          <div>
            <p className="glass-display text-[22px] font-semibold leading-snug text-[color:var(--glass-ink)]">
              {td("journeyBannerTitle")}
            </p>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {td("journeyBannerSubtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          className="glass-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-7 py-4 text-[14.5px] font-bold shadow-[0_14px_36px_-10px_rgba(91,70,229,0.6)]"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
