"use client";

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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const FEATURED_SITUATIONS = WIZARD_SITUATIONS.slice(0, 6);
const ACCENTS = [
  "var(--glass-accent-deep)",
  "var(--glass-pop-fg)",
  "var(--glass-accent-c)",
  "var(--glass-accent-d)",
  "var(--info)",
  "var(--glass-accent-b)",
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
    <Card
      aria-labelledby="wizard-teaser-heading"
      className="rounded-[24px] py-5 sm:py-6"
    >
      <CardHeader className="gap-2 px-5 sm:px-7">
        <CardTitle>
          <h2
            id="wizard-teaser-heading"
            className="glass-display text-[25px] font-semibold leading-tight sm:text-[29px]"
          >
            {t("situationTitle")}
          </h2>
        </CardTitle>
        <CardAction>
          <Link
            href="/chomage"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "shrink-0 text-primary",
            )}
          >
            <span className="sr-only sm:not-sr-only sm:inline">
              {t("wizardHubLink")}
            </span>
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="px-5 sm:px-7">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {FEATURED_SITUATIONS.map((situation, index) => {
            const Icon = resolveIcon(situation.icon);
            const label = resolve(situation.labelKey, situation.label);
            const accent = ACCENTS[index % ACCENTS.length];

            return (
              <Link
                key={situation.value}
                href={`/mon-dossier?situation=${encodeURIComponent(situation.value)}`}
                className="glass-interactive group flex min-h-[78px] items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    color: accent,
                    background: `color-mix(in oklab, ${accent} 13%, transparent)`,
                  }}
                >
                  <Icon strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[color:var(--glass-ink)]">
                  {label}
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
