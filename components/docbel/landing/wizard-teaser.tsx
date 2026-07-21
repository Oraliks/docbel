"use client";

// Les cartes reprennent exactement la configuration du guichet. Chaque choix
// transmet sa valeur par l'URL et ouvre donc le wizard deja preselectionne.

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Accessibility,
  ArrowRight,
  Briefcase,
  GraduationCap,
  HelpCircle,
  Hourglass,
  MapPinned,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { WIZARD_SITUATIONS } from "@/lib/dossier-wizard/config";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Briefcase,
  GraduationCap,
  Hourglass,
  Accessibility,
  HelpCircle,
  UserMinus,
  MapPinned,
};

const FEATURED_SITUATIONS = WIZARD_SITUATIONS.slice(0, 4);

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
      className="glass-surface p-4 sm:p-6 lg:p-7"
    >
      <header className="mb-5 flex flex-col gap-2 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="wizard-teaser-heading"
            className="glass-display max-w-3xl text-[27px] font-semibold leading-[1.08] sm:text-[32px]"
          >
            {t("situationTitle")}
          </h2>
          <Link
            href="/chomage"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "min-h-11")}
          >
            {t("wizardHubLink")}
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
          </Link>
        </div>
        <p className="max-w-3xl text-[13px] leading-[1.65] text-[color:var(--glass-ink-soft)] sm:text-[14px]">
          {t("situationDescription")}
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED_SITUATIONS.map((situation) => {
          const Icon = resolveIcon(situation.icon);
          const label = resolve(situation.labelKey, situation.label);

          return (
            <Link
              key={situation.value}
              href={`/mon-dossier?situation=${encodeURIComponent(situation.value)}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "glass-interactive h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-start",
              )}
            >
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]"
              >
                <Icon data-icon="inline-start" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 text-sm font-semibold leading-snug text-[color:var(--glass-ink)]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
