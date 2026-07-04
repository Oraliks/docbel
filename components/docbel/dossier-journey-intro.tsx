"use client";

/**
 * Écran d'explication d'un dossier (« journey ») — version interactive.
 *
 * Signature visuelle : le « chemin de demande » — une ligne SVG dessinée qui
 * relie les étapes illustrées (vignettes maison, cf. journey-illustrations).
 * Cliquer une étape la met au premier plan (panneau de détail, ligne de
 * progression qui se remplit). Le contenu reste 100 % piloté par la
 * `DossierDefinition` (étapes, avertissements, documents) : ce composant ne
 * fait que la mise en scène — réutilisable tel quel par tout dossier.
 *
 * Accessibilité : étapes = boutons (aria-current="step"), détail en
 * aria-live, navigation précédent/suivant, focus visible hérité du système.
 * Mouvement doux uniquement (transitions CSS), `prefers-reduced-motion` géré
 * par les primitives glass existantes.
 */

import { type ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
} from "lucide-react";
import { BundleRunner } from "./bundle-runner";
import { JourneyVignette } from "./journey-illustrations";
import type { DossierJourneyStep } from "@/lib/dossiers/types";
import type { JourneyWarning, JourneyDocument } from "@/lib/dossiers/journey";

/** Remplissage (%) de la ligne de progression pour chaque jalon atteint. */
const PATH_PROGRESS = [13, 38, 63, 96];

/** Positions des jalons sur la ligne (viewBox 400×44, tracé « à la main »). */
const PATH_NODES: Array<{ x: number; y: number }> = [
  { x: 50, y: 25 },
  { x: 150, y: 15 },
  { x: 250, y: 27 },
  { x: 350, y: 17 },
];
const PATH_D = "M10 28 C 40 18, 80 12, 120 18 S 200 32, 250 27 S 330 12, 392 19";

type DossierJourneyIntroProps = {
  journey: DossierJourneyStep[];
  warnings: JourneyWarning[];
  documents: JourneyDocument[];
  ctaLabel: string;
  ctaLabelKey?: string;
} & ComponentProps<typeof BundleRunner>;

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
  const [selected, setSelected] = useState(0);

  // Résout une clé i18n si elle existe dans le catalogue, sinon le libellé brut.
  // Clés dynamiques (fournies par le dossier) → cast requis (next-intl v4).
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
  const current = steps[selected] ?? steps[0];
  const progress = PATH_PROGRESS[Math.min(selected, PATH_PROGRESS.length - 1)];

  return (
    <section className="flex w-full flex-col gap-6">
      {/* En-tête */}
      <header className="flex flex-col gap-2">
        <h1 className="glass-display text-[28px] font-semibold leading-tight sm:text-[34px]">
          {runnerProps.bundle.name}
        </h1>
        {runnerProps.bundle.description ? (
          <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {runnerProps.bundle.description}
          </p>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* ══ Chemin de demande ══ */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Ligne dessinée + jalons (décorative — les boutons font foi) */}
          <svg
            viewBox="0 0 400 44"
            className="hidden h-11 w-full sm:block"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={PATH_D}
              fill="none"
              stroke="color-mix(in oklab, var(--glass-accent-deep) 28%, transparent)"
              strokeWidth="2"
              strokeDasharray="5 6"
              strokeLinecap="round"
            />
            <path
              d={PATH_D}
              fill="none"
              stroke="var(--glass-accent-deep)"
              strokeWidth="2.5"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={100 - progress}
              style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.4,0,0.2,1)" }}
            />
            {PATH_NODES.slice(0, steps.length).map((node, i) => (
              <circle
                key={node.x}
                cx={node.x}
                cy={node.y}
                r={i === selected ? 7 : 5}
                fill={
                  i <= selected
                    ? "var(--glass-accent-deep)"
                    : "color-mix(in oklab, var(--glass-accent-deep) 16%, transparent)"
                }
                stroke="var(--glass-accent-deep)"
                strokeWidth={i <= selected ? 0 : 1.5}
                style={{ transition: "r 300ms, fill 300ms" }}
              />
            ))}
          </svg>

          {/* Jalons cliquables */}
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {steps.map((step, i) => {
              const active = i === selected;
              return (
                <li key={step.order} className="outils-rise" style={{ animationDelay: `${i * 90}ms` }}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-current={active ? "step" : undefined}
                    className="glass-surface glass-interactive flex h-full w-full flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all"
                    style={
                      active
                        ? {
                            boxShadow: "0 0 0 2px var(--glass-accent-deep)",
                            background:
                              "color-mix(in oklab, var(--glass-accent-deep) 9%, transparent)",
                          }
                        : undefined
                    }
                  >
                    <JourneyVignette icon={step.icon} className="h-14 w-14" />
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                      {td("journeyStepEyebrow", { order: step.order })}
                    </span>
                    <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                      {resolve(step.titleKey, step.title)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Panneau de détail — rejoue l'entrée à chaque sélection */}
          <div
            key={selected}
            aria-live="polite"
            className="glass-surface outils-rise flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:gap-6"
          >
            <div
              className="glass-icon-tile flex size-24 shrink-0 items-center justify-center self-center rounded-3xl sm:size-28"
              style={{
                background: "color-mix(in oklab, var(--glass-accent-deep) 10%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
            >
              <JourneyVignette icon={current.icon} className="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                {td("journeyStepLabel", { current: selected + 1, total: steps.length })}
              </p>
              <h2 className="mt-1 text-[17px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                {resolve(current.titleKey, current.title)}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
                {resolve(current.bodyKey, current.body)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setSelected((s) => Math.max(0, s - 1))}
                disabled={selected === 0}
                aria-label={td("journeyPrev")}
                className="glass-interactive flex size-9 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--glass-accent-deep)_30%,transparent)] text-[color:var(--glass-accent-deep)] disabled:opacity-35"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelected((s) => Math.min(steps.length - 1, s + 1))}
                disabled={selected === steps.length - 1}
                aria-label={td("journeyNext")}
                className="glass-interactive flex size-9 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--glass-accent-deep)_30%,transparent)] text-[color:var(--glass-accent-deep)] disabled:opacity-35"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* CTA */}
          <div className="outils-rise" style={{ animationDelay: "360ms" }}>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              {resolve(ctaLabelKey, ctaLabel)}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {/* ══ Sidebar : conditions + documents ══ */}
        <aside className="flex flex-col gap-4">
          {warnings.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                {td("journeyConditionsTitle")}
              </p>
              {warnings.map((w, i) => {
                const critical = w.severity === "critical";
                const WIcon = critical ? AlertTriangle : Info;
                const hue = critical ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)";
                return (
                  <div
                    key={w.titleKey ?? w.title}
                    className="glass-surface outils-rise flex gap-3 rounded-2xl p-4"
                    style={{ animationDelay: `${120 + i * 90}ms` }}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, color: hue }}
                      aria-hidden
                    >
                      <WIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
                        {resolve(w.titleKey, w.title)}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                        {resolve(w.messageKey, w.message)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {documents.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                {td("journeyDocsTitle")}
              </p>
              <div className="glass-surface outils-rise flex flex-col gap-2.5 rounded-2xl p-4" style={{ animationDelay: "300ms" }}>
                {documents.map((d) => (
                  <div key={d.slug} className="flex items-center gap-2.5">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                      aria-hidden
                    >
                      <FileText className="size-3.5" />
                    </span>
                    <span className="text-[12.5px] font-medium text-[color:var(--glass-ink)]">
                      {resolve(d.titleKey, d.title)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
