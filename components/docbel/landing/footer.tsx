"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CookieIcon, ShieldCheckIcon } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { publicLocales } from "@/i18n/config";
import { useConsent } from "@/components/cookie-consent/consent-provider";

const FOOTER_LINK_CLASS =
  "rounded-lg font-semibold text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:text-[color:var(--glass-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--glass-bg-a)]";

export function LandingFooter() {
  const t = useTranslations("public.chrome");
  const { openPreferences } = useConsent();

  return (
    <footer className="glass-surface mt-auto grid gap-5 px-5 py-5 text-xs text-[color:var(--glass-ink-faint)] sm:px-6 lg:grid-cols-[minmax(14rem,1fr)_auto_auto] lg:items-center lg:gap-8">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
          <ShieldCheckIcon className="size-4" aria-hidden />
        </span>
        <span>{t("copyright", { year: new Date().getFullYear() })}</span>
      </div>

      <nav aria-label={t("discover")}>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <li>
            <Link href="/glossaire" className={FOOTER_LINK_CLASS}>
              {t("glossary")}
            </Link>
          </li>
          <li>
            <Link href="/contact" className={FOOTER_LINK_CLASS}>
              {t("contact")}
            </Link>
          </li>
          <li>
            <Link href="/accessibilite" className={FOOTER_LINK_CLASS}>
              {t("accessibility")}
            </Link>
          </li>
        </ul>
      </nav>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">
        <nav aria-label={t("legalNotice")}>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <li>
              <Link href="/mentions-legales" className={FOOTER_LINK_CLASS}>
                {t("legalNotice")}
              </Link>
            </li>
            <li>
              <Link
                href="/politique-confidentialite"
                className={FOOTER_LINK_CLASS}
              >
                {t("privacy")}
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openPreferences}
                className={`${FOOTER_LINK_CLASS} inline-flex items-center gap-1.5`}
              >
                <CookieIcon className="size-3.5" aria-hidden />
                {t("manageCookies")}
              </button>
            </li>
          </ul>
        </nav>
        <LocaleSwitcher
          localeList={publicLocales}
          compact
          className="min-h-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-2.5 text-[color:var(--glass-ink-soft)]"
        />
      </div>
    </footer>
  );
}
