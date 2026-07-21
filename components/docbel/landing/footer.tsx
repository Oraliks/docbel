"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CookieIcon, UserRoundIcon } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useConsent } from "@/components/cookie-consent/consent-provider";
import { useSiteSettings } from "@/components/site-settings/site-settings-provider";
import { publicLocales } from "@/i18n/config";

const FOOTER_LINK_CLASS =
  "w-fit rounded-lg text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:text-[color:var(--glass-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--glass-bg-a)]";

export function LandingFooter() {
  const t = useTranslations("public.chrome");
  const { openPreferences } = useConsent();
  const siteName = useSiteSettings()?.identity.name ?? "Docbel";

  return (
    <footer className="glass-surface mt-auto rounded-[24px] px-5 py-6 text-xs text-[color:var(--glass-ink-faint)] sm:px-7">
      <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-[minmax(230px,1.35fr)_repeat(3,minmax(120px,0.65fr))_auto] lg:gap-8">
        <div className="flex flex-col items-start gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          >
            <span
              className="flex size-9 items-center justify-center rounded-xl text-primary-foreground shadow-[0_4px_16px_color-mix(in_oklab,var(--glass-accent-deep)_35%,transparent)]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
              }}
            >
              <UserRoundIcon className="size-4" aria-hidden />
            </span>
            <span className="text-base font-extrabold tracking-tight text-[color:var(--glass-ink)]">
              {siteName}
            </span>
          </Link>
          <p className="max-w-64 leading-relaxed">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
        </div>

        <FooterGroup title={t("discover")}>
          <Link href="/outils" className={FOOTER_LINK_CLASS}>
            {t("quickAllTools")}
          </Link>
          <Link href="/actualites" className={FOOTER_LINK_CLASS}>
            {t("quickNews")}
          </Link>
          <Link href="/glossaire" className={FOOTER_LINK_CLASS}>
            {t("glossary")}
          </Link>
        </FooterGroup>

        <FooterGroup title={t("contact")}>
          <Link href="/contact" className={FOOTER_LINK_CLASS}>
            {t("contact")}
          </Link>
          <Link href="/accessibilite" className={FOOTER_LINK_CLASS}>
            {t("accessibility")}
          </Link>
          <Link href="/reprendre" className={FOOTER_LINK_CLASS}>
            {t("quickResume")}
          </Link>
        </FooterGroup>

        <FooterGroup title={t("legalNotice")}>
          <Link href="/mentions-legales" className={FOOTER_LINK_CLASS}>
            {t("legalNotice")}
          </Link>
          <Link href="/politique-confidentialite" className={FOOTER_LINK_CLASS}>
            {t("privacy")}
          </Link>
          <button
            type="button"
            onClick={openPreferences}
            className={`${FOOTER_LINK_CLASS} inline-flex items-center gap-1.5`}
          >
            <CookieIcon className="size-3.5" aria-hidden />
            {t("manageCookies")}
          </button>
        </FooterGroup>

        <div className="flex items-start lg:justify-end">
          <LocaleSwitcher
            localeList={publicLocales}
            compact
            className="min-h-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-2.5 text-[color:var(--glass-ink-soft)]"
          />
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <p className="font-bold text-[color:var(--glass-ink)]">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </nav>
  );
}
