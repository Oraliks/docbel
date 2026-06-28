"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { publicLocales } from "@/i18n/config";

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
        <Link
          href="/mentions-legales"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("legalNotice")}
        </Link>
        <Link
          href="/politique-confidentialite"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("privacy")}
        </Link>
        <Link
          href="/accessibilite"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          {t("accessibility")}
        </Link>
        <LocaleSwitcher
          localeList={publicLocales}
          compact
          className="text-[color:var(--glass-ink-soft)] hover:bg-white/40 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
        />
      </nav>
    </footer>
  );
}
