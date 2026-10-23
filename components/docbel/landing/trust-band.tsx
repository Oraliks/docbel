"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Leaf } from "lucide-react";

/** Un seul panneau de préférences : le bandeau ouvre le même bouton Aa. */
export function TrustBand() {
  const t = useTranslations("public.home");
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[20px] border border-[color:var(--glass-success-border)] bg-[color:var(--glass-success-surface)] px-5 py-6 sm:px-7" aria-labelledby="home-ease-heading">
      <Leaf className="size-7 shrink-0 text-[color:var(--glass-success-ink)]" aria-hidden />
      <div className="min-w-0 flex-1 basis-[230px]">
        <h2 id="home-ease-heading" className="text-base font-semibold leading-snug">{t("designEaseTitle")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--glass-ink-soft)]">{t("designEaseDescription")}</p>
      </div>
      <Link href="/accessibilite" onClick={(event) => {
        const trigger = document.querySelector<HTMLButtonElement>("[data-docbel-display-trigger]");
        if (trigger && trigger.getClientRects().length > 0) {
          event.preventDefault();
          trigger.click();
        }
      }} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[color:var(--glass-success-ink)] underline underline-offset-4"><ArrowRight className="size-4 rtl:rotate-180" aria-hidden />{t("designPreferences")}</Link>
    </section>
  );
}
