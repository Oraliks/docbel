"use client";

import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Sidebar } from "./sidebar";
import { TopBarNav } from "./topbar-nav";
import { Footer } from "./footer";
import { LoginModal } from "./login-modal";
import { AppStateContext } from "@/lib/app-state-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const PUBLIC_LAYOUT_STYLE = {
  "--sidebar-width": "18rem",
  "--sidebar-width-mobile": "20rem",
} as React.CSSProperties;

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [lang, setLang] = useState("FR");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [toolsCat, setToolsCat] = useState("Tous");

  const userLoggedIn = !isPending && Boolean(session?.user);
  const dark = resolvedTheme === "dark";

  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  let activePage = "accueil";
  if (pathname.startsWith("/actualites")) activePage = "actualites";
  if (pathname.startsWith("/contact")) activePage = "contact";

  const handleNavigate = (page: string) => {
    if (page === "actualites") {
      router.push("/actualites");
      return;
    }

    if (page === "contact") {
      router.push("/contact");
      return;
    }

    if (page === "tutoriels") {
      setToolsCat("Tutoriels");
      router.push("/");
      return;
    }

    if (page === "outils") {
      router.push("/");
      return;
    }

    router.push("/");
  };

  const toggleTheme = () => setTheme(dark ? "light" : "dark");

  return (
    <AppStateContext.Provider
      value={{
        dark,
        setDark: (value) => setTheme(value ? "dark" : "light"),
        toolsCat,
        setToolsCat,
      }}
    >
      <SidebarProvider defaultOpen style={PUBLIC_LAYOUT_STYLE}>
        <Sidebar
          accent="#C8102E"
          dark={dark}
          setDark={toggleTheme}
          lang={lang}
          setLang={setLang}
          activePage={activePage}
          setActivePage={handleNavigate}
          userLoggedIn={userLoggedIn}
          setShowLoginModal={setShowLoginModal}
          outilsOpen={false}
          setOutilsOpen={() => {}}
          width={288}
          userName={session?.user?.name || null}
          toolsCat={toolsCat}
          setToolsCat={setToolsCat}
          newsFilter="all"
          setNewsFilter={() => {}}
        />

        <SidebarInset className="min-h-svh text-foreground">
          <TopBarNav
            accent="#C8102E"
            dark={dark}
            setDark={toggleTheme}
            activePage={activePage}
            setActivePage={handleNavigate}
            userLoggedIn={userLoggedIn}
            setShowLoginModal={setShowLoginModal}
            userName={session?.user?.name || null}
            userRole={(session?.user as { role?: string })?.role || null}
            notificationCount={0}
          />

          <div className="relative flex flex-1 flex-col">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-violet-100/35 via-white/0 to-transparent dark:from-violet-500/8" />
            <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-5 lg:px-5 lg:py-5">
              {children}
            </main>
            <Footer />
          </div>
        </SidebarInset>

        {showLoginModal && (
          <LoginModal onClose={() => setShowLoginModal(false)} accent="#C8102E" />
        )}
      </SidebarProvider>
    </AppStateContext.Provider>
  );
}
