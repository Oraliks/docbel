"use client";

/**
 * Écran d'explication d'un dossier (« journey ») — mise en page « landing »
 * calquée sur la maquette validée par Oraliks.
 *
 * Structure : hero SANS carte (titre + description à gauche, illustration à
 * droite, directement sur le fond glass) → 4 cartes d'étapes numérotées et
 * illustrées, chacune avec un bouton pilule → grille « À savoir avant de
 * commencer » (avertissements en cartes, avec « En savoir plus » repliable) →
 * bandeau CTA final. Contenu 100 % piloté par la `DossierDefinition` ;
 * `BundleRunner` inchangé. Tous les CTA démarrent le questionnaire.
 */

import { type ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Coins,
  FilePlus2,
  GraduationCap,
  Info,
  type LucideIcon,
} from "lucide-react";
import { BundleRunner } from "./bundle-runner";
import { JourneyVignette } from "./journey-illustrations";
import { JourneyHeroIllustration } from "./journey-hero-illustration";
import type { DossierJourneyStep } from "@/lib/dossiers/types";
import type { JourneyWarning, JourneyDocument } from "@/lib/dossiers/journey";

type DossierJourneyIntroProps = {
  journey: DossierJourneyStep[];
  warnings: JourneyWarning[];
  documents: JourneyDocument[];
  ctaLabel: string;
  ctaLabelKey?: string;
} & ComponentProps<typeof BundleRunner>;

/** Icône « à savoir » : heuristique sur le titre, repli sur la sévérité. */
function warningIcon(title: string, severity: JourneyWarning["severity"]): LucideIcon {
  const t = title.toLowerCase();
  if (/montant|€|alloc|brut/.test(t)) return Coins;
  if (/alternance|formation|dipl/.test(t)) return GraduationCap;
  if (/stage|jour|mois|délai|delai/.test(t)) return CalendarDays;
  if (severity === "critical") return AlertTriangle;
  return Info;
}

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
    <section className="flex w-full flex-col gap-10 pb-4">
      {/* ══ Hero — SANS carte, directement sur le fond glass ══ */}
      <header className="grid items-center gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col">
          <h1 className="glass-display text-[34px] font-semibold leading-[1.05] sm:text-[46px]">
            {runnerProps.bundle.name}
          </h1>
          {runnerProps.bundle.description ? (
            <p className="mt-4 max-w-[440px] text-[15px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
              {runnerProps.bundle.description}
            </p>
          ) : null}
        </div>
        <JourneyHeroIllustration className="h-auto w-full max-w-[540px] justify-self-center lg:justify-self-end" />
      </header>

      {/* ══ 4 cartes d'étapes ══ */}
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.order} className="relative outils-rise" style={{ animationDelay: `${i * 90}ms` }}>
            {/* Chevron connecteur entre les cartes (desktop) */}
            {i < steps.length - 1 ? (
              <span
                className="absolute -right-3.5 top-1/2 z-10 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)] shadow-sm ring-1 ring-[color:var(--glass-border)] lg:flex"
                aria-hidden
              >
                <ChevronRight className="size-4" />
              </span>
            ) : null}
            <div className="glass-surface relative flex h-full flex-col items-center gap-3 rounded-3xl p-6 pt-7 text-center">
              {/* Numéro — coin haut-gauche */}
              <span className="absolute left-5 top-5 flex size-8 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--glass-accent-deep)_14%,transparent)] text-[13px] font-bold text-[color:var(--glass-accent-deep)]">
                {step.order}
              </span>
              <JourneyVignette icon={step.icon} className="mt-2 h-16 w-16" />
              <span className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {resolve(step.titleKey, step.title)}
              </span>
              <span className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                {resolve(step.bodyKey, step.body)}
              </span>
              <button
                type="button"
                onClick={start}
                className="glass-interactive mt-auto inline-flex items-center gap-1.5 rounded-full bg-[color:color-mix(in_oklab,var(--glass-accent-deep)_10%,transparent)] px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--glass-accent-deep)_18%,transparent)]"
              >
                {td("journeyStepCta")}
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>

      {/* ══ À savoir avant de commencer ══ */}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-5">
          <h2 className="glass-display w-fit border-b-2 border-[color:var(--glass-accent-deep)] pb-1.5 text-[19px] font-semibold">
            {td("journeyConditionsTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {warnings.map((w, i) => {
              const title = resolve(w.titleKey, w.title);
              const message = resolve(w.messageKey, w.message);
              const critical = w.severity === "critical";
              const WIcon = warningIcon(title, w.severity);
              const hue = critical ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)";
              const isOpen = expanded.has(i);
              return (
                <div
                  key={w.titleKey ?? w.title}
                  className="glass-surface outils-rise flex flex-col gap-2.5 rounded-3xl p-5"
                  style={{ animationDelay: `${120 + i * 80}ms` }}
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-2xl"
                    style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, color: hue }}
                    aria-hidden
                  >
                    <WIcon className="size-5" />
                  </span>
                  <p className="text-[14px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                    {title}
                  </p>
                  <p
                    className={`text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)] ${isOpen ? "" : "line-clamp-3"}`}
                  >
                    {message}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="mt-auto inline-flex w-fit items-center gap-1 pt-0.5 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? td("journeyReadLess") : td("journeyReadMore")}
                    <ArrowRight
                      className={`size-3.5 transition-transform ${isOpen ? "-rotate-90" : ""}`}
                      aria-hidden
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ══ Bandeau CTA final ══ */}
      <div className="glass-surface outils-rise flex flex-col items-start gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-center gap-4">
          <span
            className="glass-icon-tile flex size-14 shrink-0 items-center justify-center rounded-2xl text-[color:var(--glass-accent-deep)]"
            style={{
              background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
              "--tile-hue": "var(--glass-accent-deep)",
            } as React.CSSProperties}
            aria-hidden
          >
            <FilePlus2 className="size-6" />
          </span>
          <div>
            <p className="glass-display text-[21px] font-semibold leading-snug">
              {td("journeyBannerTitle")}
            </p>
            <p className="mt-1 text-[13.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {td("journeyBannerSubtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={start}
          className="glass-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
        >
          {cta}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
