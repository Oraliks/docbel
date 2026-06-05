"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { LandingCommandPalette } from "./landing/command-palette";
import { LandingFooter } from "./landing/footer";
import { LandingHeader } from "./landing/header";
import { AppStateContext } from "@/lib/app-state-context";
import { getAudienceFromPath } from "@/lib/audience";
import { TOOLS_DATA, getToolSlug } from "@/lib/docbel-data";
import { useInactiveTools } from "@/hooks/useInactiveTools";
import { useAuthSession } from "@/components/auth-session-provider";
import { ProShell } from "./pro/pro-shell";
import type { ProSegment } from "@/lib/pro-nav";

/**
 * Espaces pros connectés (partenaire/employeur) → shell Dashboard (sidebar)
 * au lieu du header glass. Décision par RÔLE : la session expose `role` mais
 * pas `partnerOrganization` ; en pratique un partner/employer a toujours une
 * org (posée à l'inscription), donc ça reflète la condition serveur des pages
 * `/partenaire` et `/employeur`. Les visiteurs/citoyens/admins gardent la
 * vitrine glass.
 */
function resolveProSegment(
  pathname: string,
  role: string | null,
): ProSegment | null {
  const under = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  if (
    role === "partner" &&
    (under("/partenaire") ||
      under("/rendez-vous") ||
      under("/outils/lookup-onem"))
  )
    return "partenaire";
  if (role === "employer" && under("/employeur")) return "employeur";
  return null;
}

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useAuthSession();
  const [toolsCat, setToolsCat] = useState("Tous");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inactiveSlugs = useInactiveTools();

  const dark = resolvedTheme === "dark";
  const visibleTools = TOOLS_DATA.filter((t) => !inactiveSlugs.has(getToolSlug(t)));

  // /admin owns its own chrome (AppSidebar inside app/admin/layout).
  // /login, /inscription, /mot-de-passe-oublie et /reinitialiser-mot-de-passe
  // sont des écrans split full-page — le header glass collerait avec.
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname === "/inscription" ||
    pathname === "/mot-de-passe-oublie" ||
    pathname === "/reinitialiser-mot-de-passe"
  ) {
    return <>{children}</>;
  }

  // Espace Dashboard pro (sidebar) — partenaires/employeurs connectés.
  const proSegment = resolveProSegment(
    pathname,
    (session?.user as { role?: string } | undefined)?.role ?? null,
  );
  if (proSegment) {
    return <ProShell segment={proSegment}>{children}</ProShell>;
  }

  // Public chrome: shared by every non-admin route. The URL drives which
  // persona the header advertises; the actual page content sits inside the
  // <main> below. Pages render whatever they want, without their own header
  // or footer.
  const audience = getAudienceFromPath(pathname);

  return (
    <AppStateContext.Provider
      value={{
        dark,
        setDark: (value) => setTheme(value ? "dark" : "light"),
        toolsCat,
        setToolsCat,
      }}
    >
      <div className="glass-root">
        <main className="mx-auto flex min-h-svh w-full max-w-[1840px] flex-col gap-6 px-6 pt-6 pb-12 lg:px-12 2xl:px-16">
          <LandingHeader
            persona={audience}
            onSearchOpen={() => setPaletteOpen(true)}
          />
          {children}
          <LandingFooter />
        </main>

        <LandingCommandPalette
          open={paletteOpen}
          setOpen={setPaletteOpen}
          tools={visibleTools}
        />
      </div>
    </AppStateContext.Provider>
  );
}
