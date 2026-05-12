import type { Metadata } from "next";
import { Fraunces, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayoutClient } from "@/components/docbel/app-layout-client";
import { VersionWatcher } from "@/components/version-watcher";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${plusJakarta.variable} ${fraunces.variable} ${manrope.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AppLayoutClient>{children}</AppLayoutClient>
          <Toaster richColors position="bottom-right" duration={3500} />
          <ConfirmDialog />
          <VersionWatcher />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
