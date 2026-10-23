"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, ListChecks, LayoutGrid, CircleHelp, Search, MoreHorizontal, LogOut, Settings, User, Moon, Sun, X } from "lucide-react";
import { useAuthSession } from "@/components/auth-session-provider";
import { DocBelLogo } from "@/components/brand/docbel-logo";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/components/theme-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AccessibilityToolbar } from "@/components/docbel/accessibility-toolbar";
import { publicLocales } from "@/i18n/config";
import type { AudienceId } from "@/lib/audience";
import { isPublicNavActive } from "@/lib/public-navigation";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const ITEMS = [
  { href: "/", key: "navHome", Icon: Home },
  { href: "/mon-dossier", key: "navMyDossier", Icon: ListChecks },
  { href: "/outils", key: "navTools", Icon: LayoutGrid },
  { href: "/aide", key: "navHelp", Icon: CircleHelp },
] as const;

function PrimaryLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("public.chrome");
  return ITEMS.map(({ href, key, Icon }) => (
    <Link href={href} key={href} className="docbel-nav-link" aria-current={isPublicNavActive(pathname, href) ? "page" : undefined}>
      {mobile ? <Icon className="size-5" aria-hidden /> : null}
      <span>{t(key)}</span>
    </Link>
  ));
}

export function PublicBottomNav() {
  const t = useTranslations("public.chrome");
  return <nav className="docbel-bottom-nav" aria-label={t("menu")}><PrimaryLinks mobile /></nav>;
}

export function LandingHeader({ onSearchOpen }: { persona: AudienceId; onSearchOpen: () => void }) {
  const t = useTranslations("public.chrome");
  const td = useTranslations("public.design");
  const { data: session } = useAuthSession();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const role = session?.user && "role" in session.user ? session.user.role : null;
  const signOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="docbel-public-header">
      <div className="docbel-header-inner">
        <Link href="/" className="docbel-brand" aria-label={t("backToHome")}>
          <DocBelLogo className="h-10 w-[min(190px,48vw)]" decorative />
        </Link>
        <nav className="docbel-public-nav" aria-label={t("menu")}><PrimaryLinks /></nav>
        <div className="docbel-header-controls">
          <button type="button" onClick={onSearchOpen} aria-label={t("search")} className="docbel-header-control docbel-desktop-control"><Search className="size-5" aria-hidden /></button>
          <LocaleSwitcher localeList={publicLocales} className="docbel-header-control px-3" />
          <Dialog>
            <DialogTrigger data-docbel-display-trigger className="docbel-header-control text-lg font-semibold" aria-label={td("displayTitle")}><span aria-hidden>Aa</span></DialogTrigger>
            <DialogContent showCloseButton={false} className="docbel-public-popup docbel-display-panel gap-5 rounded-3xl p-6 sm:max-w-md">
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-2xl font-semibold leading-tight">{td("displayTitle")}</DialogTitle>
                <DialogClose className="docbel-header-control shrink-0" aria-label={td("close")}><X className="size-5" aria-hidden /></DialogClose>
              </div>
              <DialogDescription>{td("displayDescription")}</DialogDescription>
              <AccessibilityToolbar />
              <button type="button" className="docbel-header-control justify-start gap-3 px-4" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                {resolvedTheme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
                {t("toggleTheme")}
              </button>
              <DialogClose className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{td("done")}</DialogClose>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger className="docbel-header-control docbel-desktop-control" aria-label={t("discover")}><MoreHorizontal className="size-5" aria-hidden /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="docbel-public-popup min-w-60 rounded-2xl p-2">
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href="/actualites" />}>{t("quickNews")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/rendez-vous" />}>{td("appointments")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/mes-demarches" />}>{t("navMesDemarches")}</DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/reprendre" />}>{td("existingResume")}</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {session?.user ? <>
                  <DropdownMenuItem render={<Link href="/profil" />}><User aria-hidden />{t("myAccount")}</DropdownMenuItem>
                  {role === "admin" ? <DropdownMenuItem render={<Link href="/admin" />}><Settings aria-hidden />{t("administration")}</DropdownMenuItem> : null}
                  <DropdownMenuItem onClick={signOut}><LogOut aria-hidden />{t("signOut")}</DropdownMenuItem>
                </> : <DropdownMenuItem render={<Link href="/login" />}><Settings aria-hidden />{td("privateAccess")}</DropdownMenuItem>}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
