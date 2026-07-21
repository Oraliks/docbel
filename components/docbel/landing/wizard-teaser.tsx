"use client";

// Les cartes reprennent exactement la configuration du guichet. Chaque choix
// transmet sa valeur par l'URL et ouvre donc le wizard deja preselectionne.

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

const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  GraduationCap,
  Hourglass,
  Accessibility,
  HelpCircle,
  UserMinus,
  MapPinned,
};

const TILE_HUES = [
  "var(--glass-accent-deep)",
  "var(--glass-accent-a)",
  "var(--glass-accent-c)",
] as const;

function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? HelpCircle;
}

export function WizardTeaser() {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.dossierContent");
  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    try {
      const value = tc(key as Parameters<typeof tc>[0]);
      return value && value !== key ? value : fallback;
    } catch {
      return fallback;
    }
  };

  return (
    <section
      aria-labelledby="wizard-teaser-heading"
      className="glass-surface relative overflow-hidden p-4 sm:p-6 lg:p-7"
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute -top-24 -left-16 size-52 rounded-full opacity-35 blur-3xl"
        style={{ background: "var(--glass-accent-a)" }}
      />

      <header className="relative mb-5 flex flex-col gap-2 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("wizardEyebrow")}
          </p>
          <Link
            href="/chomage"
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          >
            {t("wizardHubLink")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <h2
          id="wizard-teaser-heading"
          className="glass-display max-w-3xl text-[27px] font-semibold leading-[1.08] sm:text-[32px]"
        >
          {t("ctaCreateDossier")}
        </h2>
        <p className="max-w-3xl text-[13px] leading-[1.65] text-[color:var(--glass-ink-soft)] sm:text-[14px]">
          {t("wizardDescription")}
        </p>
      </header>

      <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {WIZARD_SITUATIONS.map((situation, index) => {
          const Icon = resolveIcon(situation.icon);
          const hue = TILE_HUES[index % TILE_HUES.length];
          const label = resolve(situation.labelKey, situation.label);
          const description = resolve(
            situation.descriptionKey,
            situation.description ?? "",
          );

          return (
            <Link
              key={situation.value}
              href={`/mon-dossier?situation=${encodeURIComponent(situation.value)}`}
              className="glass-interactive group flex min-h-[112px] items-start gap-3 rounded-[20px] border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            >
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--glass-border)] transition-transform duration-200 group-active:scale-95 motion-reduce:transition-none"
                style={{
                  background: `color-mix(in oklab, ${hue} 18%, transparent)`,
                  color: hue,
                }}
              >
                <Icon className="size-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-snug tracking-tight text-[color:var(--glass-ink)]">
                  {label}
                </span>
                <span className="mt-1.5 block text-[11.5px] leading-relaxed text-[color:var(--glass-ink-soft)]">
                  {description}
                </span>
              </span>
              <ChevronRight
                className="mt-1 size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          );
        })}

        <Link
          href="/mon-dossier"
          className="glass-cta glass-interactive group flex min-h-[112px] items-center gap-3 rounded-[20px] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-surface)]">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="flex-1 text-[13.5px] font-bold leading-snug">
            {t("wizardStartGuide")}
          </span>
          <ArrowRight
            className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
