import type { Metadata } from "next";
import { Fraunces, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
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

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image URLs and silences Next's
  // metadataBase warning. Override via NEXT_PUBLIC_SITE_URL per environment.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://docbel.be"),
  title: "Docbel — Documents administratifs belges",
  description: "Portail officieux des documents administratifs belges (chômage)",
};

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
  const messages = await getMessages();

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
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
            <AuthSessionProvider initialSession={initialSession}>
              <ImpersonationBanner />
              <AppLayoutClient>{children}</AppLayoutClient>
            </AuthSessionProvider>
            <Toaster richColors position="bottom-right" duration={3500} />
            <ConfirmDialog />
            <VersionWatcher />
            <AcronymHydrator />
            <WelcomeLocaleModal />
            <Analytics />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
