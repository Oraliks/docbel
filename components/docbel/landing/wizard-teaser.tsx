"use client";

// Teaser du guide d'orientation de /mon-dossier sur la home.
//
// Affiche les portes d'entrée RÉELLES du wizard (WIZARD_SITUATIONS — même
// source de vérité que la page /mon-dossier) en grille cliquable. Chaque
// carte de situation mène à /mon-dossier?situation=<value> : le wizard lit ce
// param (page.tsx → MonDossierClient → DossierWizard) et s'ouvre directement
// sur cette situation, sans repasser par « Quelle est votre situation ? ».
// La 8ᵉ tuile « Commencer le guide » reste un lien simple vers /mon-dossier
// (CTA générique, pas de présélection).

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  ArrowRight,
  Briefcase,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  Hourglass,
  MapPinned,
  Sparkles,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { WIZARD_SITUATIONS } from "@/lib/dossier-wizard/config";

/// Même mapping nom → icône lucide que le wizard lui-même
/// (components/docbel/onboarding/dossier-wizard.tsx) : le set est petit et
/// fixe, la config reste sérialisable.
const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  GraduationCap,
  Hourglass,
  Accessibility,
  HelpCircle,
  UserMinus,
  MapPinned,
};

function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? HelpCircle;
}

/// Rotation de teintes pastel (palette glass) pour différencier les tuiles
/// d'icônes sans sortir de la charte.
const TILE_HUES = [
  "var(--glass-accent-deep)",
  "var(--glass-accent-a)",
  "var(--glass-accent-c)",
] as const;

export function WizardTeaser() {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.dossierContent");
  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    try {
      const v = tc(key as Parameters<typeof tc>[0]);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };
  return (
    <section
      aria-labelledby="wizard-teaser-heading"
      className="glass-surface flex flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-7"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("wizardEyebrow")}
          </p>
          <Link
            href="/chomage"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
          >
            {t("wizardHubLink")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <h2
          id="wizard-teaser-heading"
          className="glass-display text-[26px] font-semibold leading-[1.1] sm:text-[30px]"
        >
          {t.rich("wizardTitle", { em: (chunks) => <em>{chunks}</em> })}
        </h2>
        <p className="max-w-2xl text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t("wizardDescription")}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WIZARD_SITUATIONS.map((situation, index) => {
          const Icon = resolveIcon(situation.icon);
          const hue = TILE_HUES[index % TILE_HUES.length];
          return (
            <Link
              key={situation.value}
              href={`/mon-dossier?situation=${encodeURIComponent(situation.value)}`}
              className="glass-surface glass-interactive outils-rise group flex items-center gap-3 p-4"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span
                className="glass-icon-tile flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.06] motion-reduce:transform-none"
                style={{
                  background: `color-mix(in oklab, ${hue} 18%, transparent)`,
                  color: hue,
                  "--tile-hue": hue,
                } as React.CSSProperties}
              >
                <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="flex-1 text-[13px] font-bold leading-snug tracking-tight text-[color:var(--glass-ink)]">
                {resolve(situation.labelKey, situation.label)}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
                aria-hidden
              />
            </Link>
          );
        })}

        {/* 8ᵉ cellule : CTA principal — complète la grille (7 situations + 1). */}
        <Link
          href="/mon-dossier"
          className="glass-cta glass-interactive outils-rise group flex items-center gap-3 rounded-[24px] p-4"
          style={{ animationDelay: `${WIZARD_SITUATIONS.length * 60}ms` }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="flex-1 text-[13.5px] font-bold leading-snug">
            {t("wizardStartGuide")}
          </span>
          <ArrowRight
            className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
