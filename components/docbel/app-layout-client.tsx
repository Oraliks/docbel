"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { LandingFooter } from "./landing/footer";
import { LandingHeader, PublicBottomNav } from "./landing/header";
import { isPublicJourney } from "@/lib/public-navigation";
import { useTranslations } from "next-intl";
import { AppStateContext } from "@/lib/app-state-context";
import { getAudienceFromPath } from "@/lib/audience";
import { TOOLS_DATA, getToolSlug } from "@/lib/docbel-data";
import { useInactiveTools } from "@/hooks/useInactiveTools";
import { useAuthSession } from "@/components/auth-session-provider";
import { useSiteSettings } from "@/components/site-settings/site-settings-provider";
import { AnnouncementBanner } from "./announcement-banner";
import { MaintenanceScreen } from "./maintenance-screen";
import { ProShell } from "./pro/pro-shell";
import type { ProSegment } from "@/lib/pro-nav";

const LandingCommandPalette = dynamic(
  () =>
    import("./landing/command-palette").then(
      (module) => module.LandingCommandPalette,
    ),
  { ssr: false },
);

/**
 * Espaces pros connectés (partenaire/employeur/organisme) → shell Dashboard
 * (sidebar) au lieu du header glass. Décision par RÔLE : la session expose
 * `role` mais pas `partnerOrganization` ; en pratique un partner/employer/
 * organisme a toujours une org (posée à l'inscription), donc ça reflète la
 * condition serveur des pages `/partenaire`, `/employeur` et `/organisme`.
 * Les visiteurs/citoyens/admins gardent la vitrine glass.
 */
function resolveProSegment(
  pathname: string,
  role: string | null,
): ProSegment | null {
  // Landings marketing publiques `/p/*` (ex: /p/partenaire, /p/employeur) :
  // toujours servir le LandingHeader, même si l'utilisateur est connecté
  // partner/employer. Ces pages vendent l'espace pro à des prospects et
  // proposent une bannière informative "déjà connecté → accéder à mon espace".
  if (pathname.startsWith("/p/")) return null;
  const under = (base: string) =>
    pathname === base || pathname.startsWith(`${base}/`);
  if (
    role === "partner" &&
    (under("/partenaire") || under("/outils/lookup-onem"))
  )
    return "partenaire";
  if (
    role === "employer" &&
    (under("/employeur") || under("/partenaire/booking"))
  )
    return "employeur";
  if (role === "organisme" && under("/organisme")) return "organisme";
  return null;
}

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tDesign = useTranslations("public.design");
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useAuthSession();
  const siteSettings = useSiteSettings();
  const [toolsCat, setToolsCat] = useState("Tous");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inactiveSlugs = useInactiveTools();

  const dark = resolvedTheme === "dark";
  const visibleTools = TOOLS_DATA.filter((t) => !inactiveSlugs.has(getToolSlug(t)));

  useEffect(() => {
    const handleGlobalSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((currentOpen) => !currentOpen);
      }
    };

    window.addEventListener("keydown", handleGlobalSearchShortcut);
    return () => window.removeEventListener("keydown", handleGlobalSearchShortcut);
  }, []);

  // /admin owns its own chrome (AppSidebar inside app/admin/layout).
  // /login, /inscription, /mot-de-passe-oublie et /reinitialiser-mot-de-passe
  // sont des écrans split full-page — le header glass collerait avec.
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    (pathname === "/inscription" || pathname.startsWith("/inscription/")) ||
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

  // Mode maintenance : coupe le shell public pour les non-admins. Ne s'applique
  // JAMAIS à /admin, /login ni aux espaces pros (branches retournées plus haut),
  // donc un admin peut toujours se connecter pour reprendre la main.
  const role = (session?.user as { role?: string } | undefined)?.role ?? null;
  const maint = siteSettings?.maintenance;
  if (maint?.enabled && !(maint.allowAdminBypass && role === "admin")) {
    return (
      <MaintenanceScreen
        siteName={siteSettings?.identity.name ?? "Docbel"}
        message={maint.message}
      />
    );
  }

  return (
    <AppStateContext.Provider
      value={{
        dark,
        setDark: (value) => setTheme(value ? "dark" : "light"),
        toolsCat,
        setToolsCat,
        // Permet aux pages (ex. barre de recherche héroïque de la home)
        // d'ouvrir la même palette que le bouton du header.
        openSearch: () => setPaletteOpen(true),
      }}
    >
      <div className="glass-root">
        <a href="#main-content" className="docbel-skip">{tDesign("skip")}</a>
        {/* Bandeau d'annonce : barre pleine largeur collée en haut, HORS du
            <main> (qui a une largeur max + padding) pour être edge-to-edge. */}
        <AnnouncementBanner />
        <LandingHeader persona={audience} onSearchOpen={() => setPaletteOpen(true)} />
        <div className="docbel-public-shell flex min-h-[80svh] flex-col" data-journey={isPublicJourney(pathname)}>
          <main id="main-content" tabIndex={-1} className="flex w-full flex-1 flex-col">
            {children}
          </main>
          <LandingFooter />
        </div>
        {!isPublicJourney(pathname) ? <PublicBottomNav /> : null}

        {paletteOpen ? (
          <LandingCommandPalette
            open={paletteOpen}
            setOpen={setPaletteOpen}
            tools={visibleTools}
          />
        ) : null}
      </div>
    </AppStateContext.Provider>
  );
}
