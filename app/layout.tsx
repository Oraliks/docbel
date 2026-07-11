import type { Metadata } from "next";
import { Fraunces, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
// RGPD (RGPD_QUEUE §1) : Vercel Analytics (et le beacon page-views) sont montés
// derrière le consentement « mesure d'audience » via <AnalyticsGate /> — rien
// ne tourne tant que l'utilisateur n'a pas accepté dans la bannière cookies.
import { CONSENT_COOKIE, parseConsent } from "@/lib/cookie-consent/consent";
import { CookieConsentProvider } from "@/components/cookie-consent/consent-provider";
import { CookieBanner } from "@/components/cookie-consent/cookie-banner";
import { AnalyticsGate } from "@/components/cookie-consent/analytics-gate";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { isRtl } from "@/i18n/config";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayoutClient } from "@/components/docbel/app-layout-client";
import { AcronymHydrator } from "@/components/docbel/acronym-hydrator";
import { VersionWatcher } from "@/components/version-watcher";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { WelcomeLocaleModal } from "@/components/welcome-locale-modal";
import { getServerAuthSession } from "@/lib/auth-session";
import { getSiteSettings } from "@/lib/site-settings.server";
import { canonicalUrl, toPublicSiteSettings } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/components/site-settings/site-settings-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Fraunces (display, italic) + Manrope (sans body) — used by the landing.
// Loaded at the root so any future page can reference --font-fraunces or
// --font-manrope without re-declaring the @next/font binding.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/**
 * Métadonnées racine dérivées des Paramètres globaux (admin) — nom, slogan,
 * URL, description, image OG, désindexation, vérifications. Lecture cachée
 * (memo-cache 60 s) ; retombe sur les défauts en cas d'indisponibilité DB.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const base = canonicalUrl(s);
  const title = s.identity.tagline
    ? `${s.identity.name} — ${s.identity.tagline}`
    : s.identity.name;
  const description = s.seo.defaultDescription;
  const ogImages = s.seo.ogImageUrl ? [{ url: s.seo.ogImageUrl }] : undefined;

  return {
    metadataBase: new URL(base),
    title: { default: title, template: s.seo.titleTemplate || "%s" },
    description,
    openGraph: {
      type: "website",
      siteName: s.identity.name,
      title,
      description,
      url: base,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
    },
    ...(s.seo.noindex ? { robots: { index: false, follow: false } } : {}),
    ...(s.seo.verification.google || s.seo.verification.bing
      ? {
          verification: {
            ...(s.seo.verification.google
              ? { google: s.seo.verification.google }
              : {}),
            ...(s.seo.verification.bing
              ? { other: { "msvalidate.01": s.seo.verification.bing } }
              : {}),
          },
        }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Lit la session côté serveur (cookieCache Better Auth = ~ms, pas de DB).
  // Permet aux headers d'afficher le bon état dès le 1er render → zéro
  // flash "Invité → Compte".
  const initialSession = await getServerAuthSession();
  // i18n (mode cookie) : locale + messages côté serveur, hydratés au provider
  // racine → couvre tout le front (vitrine glass, espaces pros, admin).
  const locale = await getLocale();
  // SPLIT admin/public : le provider RACINE ne sert QUE les messages `public.*`
  // au client (≈348 KB). Le volumineux `admin.*` (≈132 KB, FR) n'est PLUS
  // embarqué par les visiteurs publics : il est servi par un provider imbriqué
  // dans app/admin/layout.tsx (tous les consommateurs admin.* vivent sous /admin).
  // Côté SERVEUR, getTranslations garde l'accès complet (request.ts inchangé).
  const messages = await getMessages();
  const publicMessages = { public: messages.public };

  // RGPD : état de consentement lu côté serveur (anti-flash + aucun traceur
  // monté avant accord). `null` = pas de décision → la bannière s'affichera.
  const initialConsent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);

  // Paramètres globaux (tranche publique) : identité, maintenance, annonce —
  // exposés au client pour la bannière + le gate maintenance. Lecture cachée.
  const publicSiteSettings = toPublicSiteSettings(await getSiteSettings());

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${plusJakarta.variable} ${fraunces.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/*
          Pré-applique la classe "dark" et color-scheme AVANT l'hydratation
          React pour éviter le flash de thème clair sur un user en dark mode.
          Next.js 16 refuse un <script> inline à l'intérieur d'un composant
          React (overlay devtools bloquant en dev). next/script gère
          l'injection proprement.
        */}
        <Script
          id="docbel-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('docbel-theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={publicMessages}>
          <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
            <CookieConsentProvider initialConsent={initialConsent}>
              <AuthSessionProvider initialSession={initialSession}>
                <ImpersonationBanner />
                <SiteSettingsProvider value={publicSiteSettings}>
                  <AppLayoutClient>{children}</AppLayoutClient>
                </SiteSettingsProvider>
              </AuthSessionProvider>
              <Toaster richColors position="bottom-right" duration={3500} />
              <ConfirmDialog />
              <VersionWatcher />
              <AcronymHydrator />
              <WelcomeLocaleModal />
              <CookieBanner />
              {/* Traceurs montés UNIQUEMENT avec consentement « mesure d'audience ». */}
              <AnalyticsGate />
            </CookieConsentProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
