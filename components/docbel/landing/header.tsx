"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/components/auth-session-provider";
import { useTheme } from "@/components/theme-provider";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { NotificationBell } from "@/components/docbel/notification-bell";
import { AUDIENCES, type AudienceId } from "@/lib/audience";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Building2Icon,
  HandshakeIcon,
  LifeBuoyIcon,
  type LucideIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
} from "lucide-react";

interface LandingHeaderProps {
  persona: AudienceId;
  onSearchOpen: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
}> = [
  { id: "accueil", label: "Accueil", href: "/" },
  { id: "mon-dossier", label: "Mon dossier", href: "/mon-dossier" },
  { id: "actualites", label: "Actualités", href: "/actualites" },
  { id: "outils", label: "Outils", href: "/outils" },
  { id: "aide", label: "Aidez-moi", href: "/contact", icon: LifeBuoyIcon },
] as const;

// Liens directs vers les landings marketing des segments employeur/partenaire.
// Le citoyen est l'espace par défaut (`/`) et n'a pas de landing dédiée.
const AUDIENCE_NAV_ITEMS: ReadonlyArray<{
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { id: "partenaires", label: "Partenaires", href: "/p/partenaire", icon: HandshakeIcon },
  { id: "employeurs", label: "Employeurs", href: "/p/employeur", icon: Building2Icon },
] as const;

// Pick the nav item whose href is the longest prefix of the current pathname.
// `/` is treated as an exact match so `/outils` doesn't also light up Accueil
// (every pathname starts with `/`). Returns null on persona routes
// (`/employeur`, `/partenaire`) and other unmatched paths — the brand chip
// is the indicator there, no nav item should light up.
function resolveActiveNav(
  pathname: string,
): (typeof NAV_ITEMS)[number]["id"] | null {
  const match = [...NAV_ITEMS]
    .filter((item) => {
      if (item.href === "#") return false;
      if (item.href === "/") return pathname === "/";
      return pathname.startsWith(item.href);
    })
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.id ?? null;
}

// Layout only — the hover/focus/highlight background lives in glass.css
// (Tailwind v4's arbitrary `/opacity` on var(...) doesn't resolve reliably
// for `bg-[color:var(--…)]/22`, so a real CSS rule is more dependable).
const ITEM_BASE =
  "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors";

export function LandingHeader({ persona, onSearchOpen }: LandingHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const visible = useScrollReveal();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useAuthSession();
  const activeNav = resolveActiveNav(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  const current = AUDIENCES.find((aud) => aud.id === persona) ?? AUDIENCES[0];
  const Icon = current.Icon;
  const dark = resolvedTheme === "dark";

  const userLoggedIn = Boolean(session?.user);
  const userName = session?.user?.name ?? "Invité";
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? null;
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header
      data-hidden={!visible}
      className="glass-header-shell glass-surface sticky top-4 z-30 mx-auto flex w-full items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5"
    >
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          className="flex size-10 items-center justify-center rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] transition-colors hover:bg-white/55 dark:hover:bg-white/10 xl:hidden"
          aria-label="Menu"
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="glass-popup glass-surface-strong border-r-0 p-0 text-[color:var(--glass-ink)] sm:max-w-xs"
        >
          <SheetHeader className="border-b border-[color:var(--glass-ink-line)] p-5">
            <SheetTitle className="text-[18px] font-extrabold tracking-tight">
              Docbel
            </SheetTitle>
            <SheetDescription className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-soft)]">
              {current.label}
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {NAV_ITEMS.map((item) => {
              const active = item.id === activeNav;
              const ItemIcon = item.icon;
              const className = `inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                active
                  ? "bg-white/60 text-[color:var(--glass-ink)] dark:bg-white/10"
                  : "text-[color:var(--glass-ink-soft)] hover:bg-white/40 dark:hover:bg-white/8"
              }`;
              if (item.href === "#") {
                return (
                  <span
                    key={item.id}
                    className={`${className} cursor-not-allowed opacity-60`}
                  >
                    {ItemIcon ? <ItemIcon className="size-4" /> : null}
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={className}
                >
                  {ItemIcon ? <ItemIcon className="size-4" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-[color:var(--glass-ink-line)] p-3">
            <p className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              Découvrir
            </p>
            {AUDIENCE_NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/40 dark:hover:bg-white/8"
                >
                  <span
                    className="flex size-8 items-center justify-center rounded-lg text-[#2a0f4d] dark:text-white"
                    style={{
                      backgroundImage:
                        item.id === "employeurs"
                          ? "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))"
                          : "linear-gradient(135deg, var(--glass-accent-deep), var(--glass-accent-a))",
                    }}
                  >
                    <ItemIcon className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 text-[13px] font-semibold">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-1">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="flex size-10 items-center justify-center rounded-xl text-white shadow-[0_4px_16px_rgba(159,124,255,0.45)] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
          }}
        >
          <Icon className="size-5" />
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-2xl px-2 py-1 text-left transition hover:bg-white/40 dark:hover:bg-white/5"
        >
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-[18px] font-extrabold tracking-tight">Docbel</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-soft)]">
              <span
                className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                style={{ background: "var(--glass-accent-a)" }}
              />
              {current.label}
            </span>
          </span>
        </Link>
      </div>

      <nav className="ml-2 hidden items-center gap-0.5 xl:flex">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNav;
          const ItemIcon = item.icon;
          const className = `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            active
              ? "bg-white/60 text-[color:var(--glass-ink)] shadow-[inset_0_0_0_1px_var(--glass-border)] dark:bg-white/10"
              : "text-[color:var(--glass-ink-soft)] hover:bg-white/40 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/8"
          }`;
          if (item.href === "#") {
            return (
              <span key={item.id} className={`${className} cursor-not-allowed opacity-60`}>
                {ItemIcon ? <ItemIcon className="size-4" /> : null}
                {item.label}
              </span>
            );
          }
          return (
            <Link key={item.id} href={item.href} className={className}>
              {ItemIcon ? <ItemIcon className="size-4" /> : null}
              {item.label}
            </Link>
          );
        })}
        {AUDIENCE_NAV_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          const active = pathname.startsWith(item.href);
          const className = `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            active
              ? "bg-white/60 text-[color:var(--glass-ink)] shadow-[inset_0_0_0_1px_var(--glass-border)] dark:bg-white/10"
              : "text-[color:var(--glass-ink-soft)] hover:bg-white/40 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/8"
          }`;
          return (
            <Link key={item.id} href={item.href} className={className}>
              <ItemIcon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onSearchOpen}
        aria-label="Rechercher"
        className="ml-auto hidden min-w-[240px] items-center gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2.5 text-[13px] text-[color:var(--glass-ink-soft)] transition-colors hover:bg-white/55 dark:hover:bg-white/8 min-[1600px]:flex"
      >
        <SearchIcon className="size-4" />
        <span className="truncate">Rechercher un outil, un guide, une loi…</span>
        <kbd className="ml-auto rounded-md bg-[color:var(--glass-surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onSearchOpen}
        aria-label="Rechercher"
        className="ml-auto size-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:bg-white/55 dark:hover:bg-white/10 min-[1600px]:hidden"
      >
        <SearchIcon />
      </Button>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="size-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:bg-white/55 dark:hover:bg-white/10"
          aria-label="Changer le thème"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1 transition-colors hover:bg-white/55 dark:hover:bg-white/8 2xl:pr-3.5">
            <Avatar size="sm">
              <AvatarFallback
                className="text-[11px] font-bold text-white"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-[12.5px] font-bold 2xl:inline">
              {userName.split(" ")[0]}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-popup glass-surface-strong min-w-[220px] border-0 p-2 text-[color:var(--glass-ink)]"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
                {userLoggedIn ? "Mon compte" : "Compte"}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {userLoggedIn ? (
              <>
                <DropdownMenuItem
                  render={<Link href="/profil" />}
                  className={`${ITEM_BASE} text-[13px]`}
                >
                  <UserIcon className="size-4" />
                  <span className="flex-1 truncate font-semibold">{userName}</span>
                </DropdownMenuItem>
                {userRole === "admin" ? (
                  <DropdownMenuItem
                    render={
                      <a
                        href="/admin"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                    className={`${ITEM_BASE} text-[13px]`}
                  >
                    <SettingsIcon className="size-4" />
                    Administration
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator className="my-1 bg-[color:var(--glass-ink-line)]" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className={`${ITEM_BASE} text-[13px] text-[color:var(--glass-ink-soft)]`}
                >
                  <LogOutIcon className="size-4" />
                  Déconnexion
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                render={<Link href="/login" />}
                className={`${ITEM_BASE} text-[13px]`}
              >
                <UserIcon className="size-4" />
                Se connecter
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
