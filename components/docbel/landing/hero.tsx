"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ResumeStrip,
  type ResumeStripRun,
} from "@/components/docbel/landing/resume-strip";

interface LandingHeroProps {
  activeRun: ResumeStripRun | null;
}

const SITUATIONS = [
  {
    value: "perte-emploi",
    labelKey: "wizard.s.perteEmploi.label",
    Icon: BriefcaseBusiness,
  },
  {
    value: "jeune-etudes",
    labelKey: "wizard.s.jeuneEtudes.label",
    Icon: GraduationCap,
  },
  {
    value: "contrat-suspendu",
    labelKey: "wizard.s.contratSuspendu.label",
    Icon: PauseCircle,
  },
] as const;

function HowItWorksCard() {
  const t = useTranslations("public.home");
  const steps = [
    {
      title: t("guidedStep1Title"),
      description: t("guidedStep1Description"),
    },
    {
      title: t("guidedStep2Title"),
      description: t("guidedStep2Description"),
    },
    {
      title: t("guidedStep3Title"),
      description: t("guidedStep3Description"),
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          {t("guidedHowBadge")}
        </Badge>
        <CardTitle>{t("guidedHowTitle")}</CardTitle>
        <CardDescription>{t("guidedHowDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col" aria-label={t("guidedHowTitle")}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <div className="flex items-start gap-3 py-3 first:pt-0">
                <Badge
                  variant="outline"
                  className="mt-0.5 size-7 shrink-0 rounded-full p-0"
                  aria-hidden
                >
                  {index + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[color:var(--glass-ink)]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 ? <Separator /> : null}
            </li>
          ))}
        </ol>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          {t("guidedHowFooter")}
        </p>
      </CardFooter>
    </Card>
  );
}

/** Premier ecran de la home : une seule action dominante vers le guichet. */
export function LandingHero({ activeRun }: LandingHeroProps) {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.dossierContent");

  return (
    <section
      aria-labelledby="home-guided-heading"
      className="relative isolate overflow-hidden rounded-[32px] border border-[color:var(--glass-border)] px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-11"
      data-docbel-readable
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 8% 12%, var(--glass-accent-c), transparent 28%), radial-gradient(circle at 88% 18%, var(--glass-accent-a), transparent 32%), linear-gradient(135deg, var(--glass-surface), transparent 72%)",
        }}
      />

      <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col items-start justify-center py-1 sm:py-3">
          <Badge variant="secondary">{t("guidedEyebrow")}</Badge>
          <h1
            id="home-guided-heading"
            className="glass-display mt-4 max-w-3xl text-[36px] font-semibold leading-[1.02] sm:text-[48px] lg:text-[56px]"
          >
            {t("guidedTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-[1.75] text-[color:var(--glass-ink-soft)] sm:text-base">
            {t("guidedDescription")}
          </p>

          <Button
            render={<Link href="/mon-dossier" />}
            nativeButton={false}
            size="lg"
            className="mt-7 min-h-12 px-6"
          >
            <Sparkles data-icon="inline-start" aria-hidden />
            {t("guidedCta")}
            <ArrowRight
              data-icon="inline-end"
              className="rtl:rotate-180"
              aria-hidden
            />
          </Button>

          <div
            className="mt-7 flex w-full flex-col items-start gap-3"
            aria-label={t("guidedSituationsLabel")}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
              {t("guidedSituationsLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SITUATIONS.map(({ value, labelKey, Icon }) => (
                <Badge
                  key={value}
                  render={
                    <Link
                      href={`/mon-dossier?situation=${encodeURIComponent(value)}`}
                    />
                  }
                  variant="outline"
                  className="glass-interactive min-h-9 px-3 text-[12px]"
                >
                  <Icon data-icon="inline-start" aria-hidden />
                  {tc(labelKey)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0" aria-label={t("guidedAsideLabel")}>
          {activeRun ? <ResumeStrip run={activeRun} /> : <HowItWorksCard />}
        </aside>
      </div>
    </section>
  );
}
