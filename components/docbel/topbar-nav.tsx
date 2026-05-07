"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  BellIcon,
  ContactIcon,
  HomeIcon,
  LogInIcon,
  MoonIcon,
  NewspaperIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface TopBarNavProps {
  accent: string;
  dark: boolean;
  setDark: () => void;
  activePage: string;
  setActivePage: (p: string) => void;
  userLoggedIn: boolean;
  setShowLoginModal: (s: boolean) => void;
  userName?: string | null;
  userRole?: string | null;
  notificationCount?: number;
}

const NAV_ITEMS = [
  { id: "accueil", label: "Accueil", icon: HomeIcon },
  { id: "actualites", label: "Actualites", icon: NewspaperIcon },
  { id: "contact", label: "Contact", icon: ContactIcon },
];

const PAGE_TITLES: Record<string, string> = {
  accueil: "Accueil",
  actualites: "Actualites",
  contact: "Contact",
  outils: "Catalogue d'outils",
  tutoriels: "Tutoriels",
};

export function TopBarNav({
  dark,
  setDark,
  activePage,
  setActivePage,
  userLoggedIn,
  setShowLoginModal,
  userName,
  userRole,
  notificationCount = 0,
}: TopBarNavProps) {
  const router = useRouter();
  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };
  const initials = (userName || "DB")
    .split(" ")
    .map((value) => value[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 text-foreground backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="md:hidden" />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Portail public</span>
          <span className="truncate text-sm font-semibold">
            {PAGE_TITLES[activePage] || "Docbel"}
          </span>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.id}
              variant={activePage === item.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActivePage(item.id)}
            >
              <item.icon data-icon="inline-start" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={setDark}>
            {dark ? <SunIcon /> : <MoonIcon />}
            <span className="sr-only">Changer le theme</span>
          </Button>

          <Button variant="ghost" size="icon-sm" className="relative">
            <BellIcon />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 min-w-5 justify-center px-1 text-[10px]">
                {notificationCount}
              </Badge>
            )}
            <span className="sr-only">Notifications</span>
          </Button>

          {userLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm hover:bg-muted">
                <Avatar size="sm">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-28 truncate sm:inline">{userName || "Compte"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Compte</DropdownMenuLabel>
                  <DropdownMenuItem disabled>{userName || "Utilisateur"}</DropdownMenuItem>
                  {userRole && <DropdownMenuItem disabled>Role: {userRole}</DropdownMenuItem>}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {userRole === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <SettingsIcon />
                    Administration
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogInIcon />
                  Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => setShowLoginModal(true)}>
              <LogInIcon data-icon="inline-start" />
              Connexion
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
