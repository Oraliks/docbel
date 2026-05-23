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

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [toolsCat, setToolsCat] = useState("Tous");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const inactiveSlugs = useInactiveTools();

  const dark = resolvedTheme === "dark";
  const visibleTools = TOOLS_DATA.filter((t) => !inactiveSlugs.has(getToolSlug(t)));

  // /admin owns its own chrome (AppSidebar inside app/admin/layout).
  // /login is a full-screen split layout — header would clash with it.
  if (pathname.startsWith("/admin") || pathname.startsWith("/login")) {
    return <>{children}</>;
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
