import type { Metadata } from "next";
import { Fraunces, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayoutClient } from "@/components/docbel/app-layout-client";
import { AcronymHydrator } from "@/components/docbel/acronym-hydrator";
import { VersionWatcher } from "@/components/version-watcher";
import { AuthSessionProvider } from "@/components/auth-session-provider";
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

  return (
    <html
      lang="fr"
      className={`${plusJakarta.variable} ${fraunces.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('docbel-theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AuthSessionProvider initialSession={initialSession}>
            <AppLayoutClient>{children}</AppLayoutClient>
          </AuthSessionProvider>
          <Toaster richColors position="bottom-right" duration={3500} />
          <ConfirmDialog />
          <VersionWatcher />
          <AcronymHydrator />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
