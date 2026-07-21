"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/lib/app-state-context";
import { cn } from "@/lib/utils";
import {
  ResumeStrip,
  type ResumeStripRun,
} from "@/components/docbel/landing/resume-strip";

interface LandingHeroProps {
  activeRun: ResumeStripRun | null;
}

const SEARCH_EXAMPLES = [
  "searchExample1",
  "searchExample2",
  "searchExample3",
] as const;

function HowItWorksCard() {
  const t = useTranslations("public.home");
  const steps = [
    {
      title: t("guidedStep1Title"),
      description: t("guidedStep1Description"),
      Icon: FileSearch,
    },
    {
      title: t("guidedStep2Title"),
      description: t("guidedStep2Description"),
      Icon: ListChecks,
    },
    {
      title: t("guidedStep3Title"),
      description: t("guidedStep3Description"),
      Icon: CheckCircle2,
    },
  ];

  return (
    <Card className="h-full rounded-[24px] py-5">
      <CardHeader className="gap-2 px-5">
        <Badge variant="secondary" className="w-fit">
          {t("guidedHowBadge")}
        </Badge>
        <CardTitle className="glass-display text-[22px] font-semibold leading-tight sm:text-[25px]">
          {t("guidedHowTitle")}
        </CardTitle>
        <CardDescription className="leading-relaxed">
          {t("guidedHowDescription")}
        </CardDescription>
        <CardAction>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ListChecks aria-hidden />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1 px-5">
        <ol aria-label={t("guidedHowTitle")}>
          {steps.map(({ title, description, Icon }, index) => (
            <li key={title}>
              <div className="flex items-start gap-3 py-3 first:pt-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[color:var(--glass-ink)]">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">
                    {description}
                  </p>
                </div>
              </div>
              {index < steps.length - 1 ? <Separator /> : null}
            </li>
          ))}
        </ol>
      </CardContent>
      <CardFooter className="border-0 bg-transparent px-5 pt-0">
        <Link
          href="/mon-dossier"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {t("guidedCta")}
          <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
        </Link>
      </CardFooter>
    </Card>
  );
}

/** Accueil guide : recherche dominante, illustration et reprise reelle du dossier. */
export function LandingHero({ activeRun }: LandingHeroProps) {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.chrome");
  const { openSearch } = useAppState();

  return (
    <section
      aria-labelledby="home-guided-heading"
      className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2.08fr)_minmax(330px,0.98fr)]"
    >
      <div
        className="glass-surface relative isolate min-h-[360px] overflow-hidden rounded-[28px] px-5 py-8 sm:px-8 lg:px-10"
        data-docbel-readable
      >
        <div
          aria-hidden
          data-a11y-secondary="true"
          className="absolute inset-0 -z-20"
          style={{
            background:
              "radial-gradient(circle at 0% 100%, color-mix(in oklab, var(--glass-accent-c) 32%, transparent), transparent 38%), radial-gradient(circle at 72% 20%, color-mix(in oklab, var(--glass-accent-a) 30%, transparent), transparent 42%), linear-gradient(115deg, var(--glass-surface-strong), color-mix(in oklab, var(--glass-bg-d) 50%, transparent))",
          }}
        />

        <div className="relative z-10 flex h-full max-w-[620px] flex-col justify-center lg:w-[68%]">
          <Badge variant="secondary" className="mb-4 w-fit">
            {t("guidedEyebrow")}
          </Badge>
          <h1
            id="home-guided-heading"
            className="glass-display max-w-[620px] text-[40px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[48px] lg:text-[50px]"
          >
            {t("guidedTitle")}
          </h1>
          <p className="mt-5 max-w-[590px] text-sm leading-[1.75] text-[color:var(--glass-ink-soft)] sm:text-base">
            {t("guidedDescription")}
          </p>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={openSearch}
            aria-label={t("searchOpenLabel", { modifier: "ctrl" })}
            className="mt-7 h-15 w-full justify-start rounded-2xl border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] px-4 text-[color:var(--glass-ink-soft)] shadow-[0_12px_28px_rgba(91,70,229,0.10)] sm:h-16 sm:px-5"
          >
            <Search data-icon="inline-start" className="text-[color:var(--glass-ink)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-start text-sm font-medium sm:text-base">
              {tc("searchPlaceholder")}
            </span>
            <kbd className="hidden rounded-lg bg-[color:var(--glass-surface-strong)] px-2 py-1 text-xs font-bold text-[color:var(--glass-ink-faint)] shadow-[inset_0_0_0_1px_var(--glass-border)] sm:inline-flex">
              Ctrl K
            </kbd>
          </Button>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[color:var(--glass-ink-faint)]">
              {t("searchPrefix")}
            </span>
            {SEARCH_EXAMPLES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={openSearch}
                className="glass-interactive min-h-8 rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 text-xs font-semibold text-[color:var(--glass-ink-soft)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <div
          aria-hidden
          data-a11y-secondary="true"
          className="pointer-events-none absolute -right-10 bottom-[-66px] hidden w-[45%] min-w-[355px] max-w-[480px] lg:block"
        >
          <div className="absolute inset-[18%] -z-10 rounded-full bg-[color:var(--glass-accent-b)] opacity-30 blur-3xl" />
          <Image
            src="/illustrations/docbel-home-hero.png"
            alt=""
            width={900}
            height={900}
            priority
            sizes="(min-width: 1280px) 520px, 40vw"
            className="h-auto w-full drop-shadow-[0_28px_34px_rgba(91,70,229,0.24)]"
          />
        </div>
      </div>

      <aside className="min-w-0" aria-label={t("guidedAsideLabel")}>
        {activeRun ? <ResumeStrip run={activeRun} /> : <HowItWorksCard />}
      </aside>
    </section>
  );
}
