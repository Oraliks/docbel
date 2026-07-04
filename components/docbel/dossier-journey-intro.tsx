"use client";

/**
 * Écran d'explication d'un dossier (« journey ») — mise en page « landing ».
 *
 * Structure (façon maquette validée) : hero illustré → 4 cartes d'étapes
 * numérotées et illustrées → grille « à savoir avant de commencer » →
 * bandeau CTA final. Le contenu reste 100 % piloté par la `DossierDefinition`
 * (étapes, avertissements, documents) — ce composant n'est que la mise en scène,
 * réutilisable par tout dossier qui déclare un `journey`.
 *
 * Un clic sur un CTA (carte d'étape ou bandeau) démarre le questionnaire
 * (`BundleRunner`, inchangé). Mouvement doux, `prefers-reduced-motion`-safe.
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
  FileText,
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
  documents,
  ctaLabel,
  ctaLabelKey,
  ...runnerProps
}: DossierJourneyIntroProps) {
  const t = useTranslations("public.dossierContent");
  const td = useTranslations("public.dossier");
  const [started, setStarted] = useState(false);

  // Résout une clé i18n si elle existe dans le catalogue, sinon le libellé brut.
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
    <section className="flex w-full flex-col gap-7">
      {/* ══ Hero : texte + illustration ══ */}
      <header className="glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 100% at 82% 40%, color-mix(in oklab, var(--glass-accent-deep) 12%, transparent) 0%, transparent 62%)",
          }}
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col">
            <h1 className="glass-display text-[30px] font-semibold leading-[1.08] sm:text-[40px]">
              {runnerProps.bundle.name}
            </h1>
            {runnerProps.bundle.description ? (
              <p className="mt-4 max-w-[460px] text-[14px] leading-[1.65] text-[color:var(--glass-ink-soft)]">
                {runnerProps.bundle.description}
              </p>
            ) : null}
          </div>
          <JourneyHeroIllustration className="h-auto w-full max-w-[520px] justify-self-center lg:justify-self-end" />
        </div>
      </header>

      {/* ══ Étapes : 4 cartes numérotées, illustrées, avec CTA ══ */}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.order} className="relative outils-rise" style={{ animationDelay: `${i * 90}ms` }}>
            {/* Connecteur chevron entre les cartes (desktop) */}
            {i < steps.length - 1 ? (
              <ChevronRight
                className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 rounded-full bg-[color:var(--glass-surface-strong)] p-0.5 text-[color:var(--glass-accent-deep)] shadow-sm lg:block"
                aria-hidden
              />
            ) : null}
            <button
              type="button"
              onClick={start}
              className="glass-surface glass-interactive group flex h-full w-full flex-col items-center gap-3 rounded-2xl p-5 text-center transition-transform hover:-translate-y-0.5"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[color:var(--glass-accent-deep)] text-[13px] font-bold text-white">
                {step.order}
              </span>
              <span
                className="glass-icon-tile flex size-20 items-center justify-center rounded-2xl"
                style={{
                  background: "color-mix(in oklab, var(--glass-accent-deep) 10%, transparent)",
                  "--tile-hue": "var(--glass-accent-deep)",
                } as React.CSSProperties}
              >
                <JourneyVignette icon={step.icon} className="h-14 w-14" />
              </span>
              <span className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {resolve(step.titleKey, step.title)}
              </span>
              <span className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                {resolve(step.bodyKey, step.body)}
              </span>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)]">
                {td("journeyStepCta")}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* ══ À savoir avant de commencer ══ */}
      {warnings.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="glass-display w-fit border-b-2 border-[color:var(--glass-accent-deep)] pb-1 text-[19px] font-semibold">
            {td("journeyConditionsTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {warnings.map((w, i) => {
              const title = resolve(w.titleKey, w.title);
              const critical = w.severity === "critical";
              const WIcon = warningIcon(title, w.severity);
              const hue = critical ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)";
              return (
                <div
                  key={w.titleKey ?? w.title}
                  className="glass-surface outils-rise flex flex-col gap-2.5 rounded-2xl p-5"
                  style={{ animationDelay: `${120 + i * 80}ms` }}
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, color: hue }}
                    aria-hidden
                  >
                    <WIcon className="size-5" />
                  </span>
                  <p className="text-[14px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                    {title}
                  </p>
                  <p className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                    {resolve(w.messageKey, w.message)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ══ Documents à prévoir (repli discret sous les cartes) ══ */}
      {documents.length > 0 ? (
        <div className="glass-surface flex flex-col gap-3 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
            {td("journeyDocsTitle")}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {documents.map((d) => (
              <span key={d.slug} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[color:var(--glass-ink)]">
                <FileText className="size-3.5 text-[color:var(--glass-accent-deep)]" aria-hidden />
                {resolve(d.titleKey, d.title)}
              </span>
            ))}
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
            <p className="glass-display text-[20px] font-semibold leading-snug">
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
