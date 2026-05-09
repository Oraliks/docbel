import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayoutClient } from "@/components/docbel/app-layout-client";
import "./globals.css";
 
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
    <html lang="fr" className={`${plusJakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <AppLayoutClient>{children}</AppLayoutClient>
          <Toaster richColors position="bottom-right" duration={3500} />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
