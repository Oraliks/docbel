"use client";

import {
  BookOpenIcon,
  CalculatorIcon,
  FileTextIcon,
  GraduationCapIcon,
  HeartHandshakeIcon,
  HomeIcon,
  LandmarkIcon,
  MoonIcon,
  NewspaperIcon,
  SunIcon,
  MailIcon,
} from "lucide-react";
import {
  Sidebar as AppSidebarShell,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

interface SidebarProps {
  accent: string;
  dark: boolean;
  setDark: (d: boolean | ((prev: boolean) => boolean)) => void;
  lang: string;
  setLang: (l: string) => void;
  activePage: string;
  setActivePage: (p: string) => void;
  userLoggedIn: boolean;
  setShowLoginModal: (s: boolean) => void;
  outilsOpen: boolean;
  setOutilsOpen: (o: boolean | ((prev: boolean) => boolean)) => void;
  width: number;
  userName?: string | null;
  toolsCat: string;
  setToolsCat: (c: string) => void;
  newsFilter?: string;
  setNewsFilter?: (f: string) => void;
}

const NAV_ITEMS = [
  { id: "accueil", label: "Accueil", icon: HomeIcon },
  { id: "actualites", label: "Actualites", icon: NewspaperIcon },
  { id: "contact", label: "Contact", icon: MailIcon },
];

const CATEGORY_ITEMS = [
  { id: "Tous", label: "Tous les outils", icon: FileTextIcon },
  { id: "Documents", label: "Documents", icon: FileTextIcon },
  { id: "Calculs", label: "Calculs", icon: CalculatorIcon },
  { id: "Organismes", label: "Organismes", icon: LandmarkIcon },
  { id: "CPAS", label: "CPAS", icon: HeartHandshakeIcon },
  { id: "Tutoriels", label: "Tutoriels", icon: GraduationCapIcon },
];

export function Sidebar({
  dark,
  setDark,
  activePage,
  setActivePage,
  toolsCat,
  setToolsCat,
}: SidebarProps) {
  const counts: Record<string, number> = {
    Tous: 10,
    Documents: 3,
    Calculs: 3,
    Organismes: 2,
    CPAS: 1,
    Tutoriels: 1,
  };

  return (
    <AppSidebarShell variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activePage === "accueil"}
              onClick={() => setActivePage("accueil")}
              className="h-auto items-start px-3 py-3"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileTextIcon />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="truncate text-sm font-semibold">Docbel</span>
                <span className="text-xs text-muted-foreground">
                  Portail documents et demarches
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activePage === item.id}
                    onClick={() => setActivePage(item.id)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Outils</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CATEGORY_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={toolsCat === item.id}
                    onClick={() => {
                      setToolsCat(item.id);
                      setActivePage("outils");
                    }}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>{counts[item.id] ?? 0}</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Ressources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActivePage("actualites")}>
                  <NewspaperIcon />
                  <span>Mises a jour recentes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActivePage("tutoriels")}>
                  <BookOpenIcon />
                  <span>Guides pratiques</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setDark((value) => !value)}>
              {dark ? <SunIcon /> : <MoonIcon />}
              <span>{dark ? "Passer au mode clair" : "Passer au mode sombre"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </AppSidebarShell>
  );
}
