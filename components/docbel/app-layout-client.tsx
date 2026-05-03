"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Sidebar } from "./sidebar";
import { TopBarNav } from "./topbar-nav";
import { Footer } from "./footer";
import { LoginModal } from "./login-modal";
import { AppStateContext } from "@/lib/app-state-context";

const TWEAKS = {
  accentColor: "#C8102E",
  sidebarWidth: 248,
};

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState("FR");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [toolsCat, setToolsCat] = useState("Tous");

  // status === "loading" pendant l'hydratation → on n'affiche pas encore l'état connecté/déconnecté
  const userLoggedIn = status === "authenticated";
  const accent = TWEAKS.accentColor;
  const dark = theme === "dark";

  // Si on est dans /admin, on retourne juste les enfants sans le layout public
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Determine active page from pathname
  let activePage = "accueil";
  if (pathname.startsWith("/actualites")) activePage = "actualites";
  else if (pathname.startsWith("/contact")) activePage = "contact";

  const handleNavigate = (page: string) => {
    if (page === "actualites") router.push("/actualites");
    else if (page === "contact") router.push("/contact");
    else if (page in { autres: 1, calculs: 1, organismes: 1, cpas: 1, juridique: 1, tutoriels: 1 }) {
      const catMap: Record<string, string> = {
        autres: "Documents",
        calculs: "Calculs",
        organismes: "Organismes",
        cpas: "CPAS",
        juridique: "Juridique",
        tutoriels: "Tutoriels",
      };
      setToolsCat(catMap[page]);
      router.push("/");
    } else {
      router.push("/");
    }
  };

  const toggleTheme = () => setTheme(dark ? "light" : "dark");

  return (
    <AppStateContext.Provider value={{ toolsCat, setToolsCat }}>
    <div
      className="flex flex-col h-screen bg-background text-foreground overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <TopBarNav
        accent={accent}
        dark={dark}
        setDark={toggleTheme}
        activePage={activePage}
        setActivePage={handleNavigate}
        userLoggedIn={userLoggedIn}
        setShowLoginModal={setShowLoginModal}
        userName={session?.user?.name || null}
        userRole={(session?.user as any)?.role || null}
        notificationCount={0}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          accent={accent}
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
          width={TWEAKS.sidebarWidth}
          userName={session?.user?.name || null}
          toolsCat={toolsCat}
          setToolsCat={setToolsCat}
          newsFilter="all"
          setNewsFilter={() => {}}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">{children}</div>
          <div className="flex-shrink-0">
            <Footer accent={accent} />
          </div>
        </main>
      </div>

      {showLoginModal && (
        <LoginModal
          accent={accent}
          dark={dark}
          onClose={() => setShowLoginModal(false)}
          onLogin={() => setShowLoginModal(false)}
        />
      )}
    </div>
    </AppStateContext.Provider>
  );
}
