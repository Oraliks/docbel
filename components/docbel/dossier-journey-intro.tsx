"use client";

import { type ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  UserCheck,
  CalendarDays,
  FileCheck,
  Wallet,
  ArrowRight,
  AlertTriangle,
  Info,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { BundleRunner } from "./bundle-runner";
import type { DossierJourneyStep, JourneyStepIcon } from "@/lib/dossiers/types";
import type { JourneyWarning, JourneyDocument } from "@/lib/dossiers/journey";

const JOURNEY_ICONS: Record<JourneyStepIcon, LucideIcon> = {
  "user-check": UserCheck,
  calendar: CalendarDays,
  "file-check": FileCheck,
  wallet: Wallet,
};

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
  const [started, setStarted] = useState(false);

  // Résout une clé i18n si elle existe dans le catalogue, sinon le libellé brut.
  // Les clés sont dynamiques (fournies par le dossier) ; next-intl v4 type
  // strictement `t`/`t.has` sur l'union des clés connues → cast requis (même
  // pattern que components/docbel/landing/bottom.tsx).
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

      {/* Corps : étapes (gauche) + sidebar (droite) */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Étapes */}
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, i) => {
            const Icon = JOURNEY_ICONS[step.icon];
            return (
              <li
                key={step.order}
                className="glass-surface outils-rise flex flex-col gap-2 p-5"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
                    style={
                      {
                        background:
                          "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                        "--tile-hue": "var(--glass-accent-deep)",
                      } as React.CSSProperties
                    }
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                    Étape {step.order}
                  </span>
                </div>
                <h2 className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                  {resolve(step.titleKey, step.title)}
                </h2>
                <p className="text-[13.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                  {resolve(step.bodyKey, step.body)}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Sidebar : avertissements + documents */}
        <aside className="flex flex-col gap-4">
          {warnings.map((w) => {
            const critical = w.severity === "critical";
            const WIcon = critical ? AlertTriangle : Info;
            return (
              <div
                key={w.titleKey ?? w.title}
                className="glass-surface flex flex-col gap-1.5 p-4"
                style={{
                  borderLeft: `3px solid ${
                    critical
                      ? "var(--glass-pop-fg)"
                      : "color-mix(in oklab, var(--glass-accent-deep) 45%, transparent)"
                  }`,
                }}
              >
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--glass-ink)]">
                  <WIcon
                    className="size-3.5 shrink-0"
                    style={{ color: critical ? "var(--glass-pop-fg)" : "var(--glass-accent-deep)" }}
                    aria-hidden
                  />
                  {resolve(w.titleKey, w.title)}
                </p>
                <p className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                  {resolve(w.messageKey, w.message)}
                </p>
              </div>
            );
          })}

          {documents.length > 0 ? (
            <div className="glass-surface flex flex-col gap-2 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                À prévoir
              </p>
              <ul className="flex flex-col gap-1.5">
                {documents.map((d) => (
                  <li
                    key={d.slug}
                    className="flex items-start gap-2 text-[12.5px] text-[color:var(--glass-ink-soft)]"
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0 text-[color:var(--glass-accent-deep)]" aria-hidden />
                    <span>{resolve(d.titleKey, d.title)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* CTA */}
      <div>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold"
        >
          {resolve(ctaLabelKey, ctaLabel)}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
