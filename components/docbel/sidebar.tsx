"use client";

import { useRouter } from "next/navigation";
import {
  BookOpenIcon,
  CalculatorIcon,
  CheckIcon,
  ChevronsUpDownIcon,
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
import { cn } from "@/lib/utils";
import { AUDIENCES, getAudience, type AudienceId } from "@/lib/audience";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  audience: AudienceId;
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
  audience,
}: SidebarProps) {
  const router = useRouter();
  const counts: Record<string, number> = {
    Tous: 10,
    Documents: 3,
    Calculs: 3,
    Organismes: 2,
    CPAS: 1,
    Tutoriels: 1,
  };

  const currentAudience = getAudience(audience);
  const showCategories = audience === "citoyen";

  return (
    <AppSidebarShell variant="inset" collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton className="h-auto items-center px-3 py-3 aria-expanded:bg-sidebar-accent" />
                }
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    currentAudience.logoMarkClass,
                  )}
                >
                  <FileTextIcon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span className="truncate text-sm font-semibold">Docbel</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        currentAudience.dotClass,
                      )}
                    />
                    <span className="truncate">{currentAudience.label}</span>
                  </span>
                </span>
                <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={6}
                className="min-w-72"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                    Changer d&apos;espace
                  </DropdownMenuLabel>
                  {AUDIENCES.map((aud) => (
                    <DropdownMenuItem
                      key={aud.id}
                      onClick={() => router.push(aud.path)}
                      className="gap-2.5"
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md",
                          aud.iconBgClass,
                        )}
                      >
                        <aud.Icon className="size-3.5" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-medium">{aud.label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {aud.description}
                        </span>
                      </div>
                      {audience === aud.id && (
                        <CheckIcon className="size-4 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {showCategories && (
          <>
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
          </>
        )}

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
