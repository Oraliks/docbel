"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function LandingFooter() {
  const t = useTranslations("public.chrome");
  return (
    <footer
      // `mt-auto` plus the parent <main>'s `min-h-svh` flex column pins the
      // footer to the bottom of the viewport on short pages, while letting it
      // ride down naturally when content overflows.
      className="mt-auto flex flex-col items-start justify-between gap-2 border-t px-6 py-5 text-[12px] text-[color:var(--glass-ink-faint)] sm:flex-row sm:items-center"
      style={{ borderTopColor: "var(--glass-ink-line)" }}
    >
      <span>{t("copyright", { year: 2026 })}</span>
      <nav className="flex flex-wrap gap-4">
        <Link
          href="/glossaire"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("glossary")}
        </Link>
        <Link
          href="/contact"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("contact")}
        </Link>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("legalNotice")}
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("privacy")}
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("accessibility")}
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("langSwitch")}
        </a>
      </nav>
    </footer>
  );
}
