"use client";

import { PUBLIC_WRITES_PAUSED } from "@/lib/public-access";
import { TemporaryClosureNotice } from "../temporary-closure-notice";
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpeechButton } from "@/components/docbel/speech-button";
import { useAppState } from "@/lib/app-state-context";
import { cn } from "@/lib/utils";

interface LandingHeroProps {
  aside: ReactNode;
  actions?: ReactNode;
}

export function HowItWorksCard() {
  const t = useTranslations("public.home");
  const steps = [
    { title: t("designStep1"), description: t("designStep1Description") },
    { title: t("designStep2"), description: t("designStep2Description") },
    { title: t("designStep3"), description: t("designStep3Description") },
  ];

  if (PUBLIC_WRITES_PAUSED) return <TemporaryClosureNotice kind="dossier" />;

  return (
    <section className="relative h-full overflow-hidden rounded-[28px] border border-[color:var(--glass-border)] bg-[color:var(--glass-accent-soft)] p-6 sm:p-8" aria-labelledby="home-guide-title">
      <div aria-hidden data-a11y-secondary="true" className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full border-[28px] border-[color:var(--glass-accent-deep)] opacity-[0.035]" />
      <div className="relative flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-soft)]">{t("designGuideTag")}</p>
        <span className="flex size-8 items-center justify-center rounded-xl bg-[color:var(--glass-surface)] text-[color:var(--glass-accent-deep)]"><Sparkles className="size-4" aria-hidden /></span>
      </div>
      <h2 id="home-guide-title" className="relative mt-4 max-w-[330px] text-[24px] font-semibold leading-[1.3] tracking-[-0.03em] sm:text-[27px]">{t("designGuideTitle")}</h2>
      <ol className="relative mt-7 grid grid-cols-3 gap-3 sm:grid-cols-1 sm:gap-0">
        {steps.map(({ title, description }, index) => (
          <li key={title} className="relative flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4 sm:pb-5 sm:last:pb-0">
            {index < steps.length - 1 ? <span aria-hidden className="absolute start-8 end-0 top-4 h-px bg-[color:var(--glass-border)] sm:start-4 sm:top-8 sm:h-[calc(100%-2rem)] sm:w-px" /> : null}
            <span aria-hidden className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", index === 0 ? "border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-accent-deep)] text-[color:var(--glass-cta-text)]" : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]")}>{index + 1}</span>
            <div className="min-w-0 sm:pt-0.5">
              <h3 className="text-xs font-semibold leading-relaxed sm:text-sm">{title}</h3>
              <p className="mt-1 hidden text-xs leading-relaxed text-[color:var(--glass-ink-soft)] sm:block">{description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Le titre reste immédiat ; reprise et accompagnement arrivent en streaming. */
export function LandingHero({ aside, actions }: LandingHeroProps) {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.chrome");
  const { openSearch } = useAppState();
  const speechText = [t("designTitle"), t("designTitleAccent"), t("designDescription")].join(" ");

  return (
    <section aria-labelledby="home-guided-heading" className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
      <div className="min-w-0 py-2" data-docbel-readable>
        <p className="mb-5 flex items-center gap-2 text-xs font-semibold text-[color:var(--glass-accent-deep)]"><span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />{t("designEyebrow")}</p>
        <h1 id="home-guided-heading" className="text-[40px] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-[52px] xl:text-[60px]">
          {t("designTitle")}<br /><em className="font-serif font-normal tracking-[-0.04em] text-[color:var(--glass-accent-deep)]">{t("designTitleAccent")}</em>
        </h1>
        <p className="mt-6 max-w-[460px] text-base leading-[1.75] text-[color:var(--glass-ink-soft)] sm:text-lg">{t("designDescription")}</p>
        <div className="mt-7 flex flex-wrap items-center gap-2 sm:gap-4">
          {actions ?? <Link href="/mon-dossier" className={cn(buttonVariants({ size: "lg" }), "min-h-14 flex-1 rounded-[14px] px-5 text-sm sm:flex-none")}>
            {t("guidedCta")}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>}
          <SpeechButton text={speechText} label={t("designListen")} className="min-h-12 shrink-0" />
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] leading-relaxed text-[color:var(--glass-ink-soft)]"><ShieldCheck className="size-3.5 shrink-0 text-[color:var(--glass-success-ink)]" aria-hidden />{t("designAssurance")}</p>
        <Button type="button" variant="ghost" onClick={openSearch} aria-label={t("searchOpenLabel", { modifier: "ctrl" })} className="mt-5 h-auto min-h-10 justify-start px-0 text-xs text-[color:var(--glass-ink-soft)]">
          <Search className="size-4" aria-hidden /><span>{tc("searchPlaceholder")}</span>
        </Button>
      </div>
      <aside className="min-w-0 self-stretch" aria-label={t("guidedAsideLabel")}>{aside}</aside>
    </section>
  );
}
