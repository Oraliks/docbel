"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/components/auth-session-provider";
import { useSiteSettings } from "@/components/site-settings/site-settings-provider";
import { useTheme } from "@/components/theme-provider";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { NotificationBell } from "@/components/docbel/notification-bell";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { publicLocales } from "@/i18n/config";
import { AUDIENCES, type AudienceId } from "@/lib/audience";
import {
  getAccessibilityPreferencesServerSnapshot,
  getAccessibilityPreferencesSnapshot,
  subscribeAccessibilityPreferences,
  updateAccessibilityPreferences,
  type DocbelTextSize,
} from "@/lib/accessibility-preferences";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AccessibilityIcon,
  Building2Icon,
  CompassIcon,
  ContrastIcon,
  GaugeIcon,
  HomeIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  NewspaperIcon,
  PauseIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

interface LandingHeaderProps {
  persona: AudienceId;
  onSearchOpen: () => void;
}

const NAV_ITEMS: ReadonlyArray<{
  id: string;
  tKey:
    | "navHome"
    | "navMyDossier"
    | "navMesDemarches"
    | "navTools"
    | "quickNews";
  href: string;
  icon: LucideIcon;
}> = [
  { id: "accueil", tKey: "navHome", href: "/", icon: HomeIcon },
  {
    id: "mon-dossier",
    tKey: "navMyDossier",
    href: "/mon-dossier",
    icon: CompassIcon,
  },
  {
    id: "mes-demarches",
    tKey: "navMesDemarches",
    href: "/mes-demarches",
    icon: ListChecksIcon,
  },
  { id: "outils", tKey: "navTools", href: "/outils", icon: WrenchIcon },
  {
    id: "actualites",
    tKey: "quickNews",
    href: "/actualites",
    icon: NewspaperIcon,
  },
] as const;

const AUDIENCE_NAV_ITEMS: ReadonlyArray<{
  id: string;
  tKey: "navEmployers";
  href: string;
  icon: LucideIcon;
}> = [
  {
    id: "employeurs",
    tKey: "navEmployers",
    href: "/p/employeur",
    icon: Building2Icon,
  },
] as const;

const DOSSIER_FUNNEL_PREFIXES = [
  "/mon-dossier",
  "/onboarding",
  "/d",
  "/document",
  "/reprendre",
] as const;

const TEXT_SIZE_STEPS: readonly DocbelTextSize[] = [
  "small",
  "normal",
  "large",
  "xlarge",
];

const TEXT_SIZE_KEYS: Record<
  DocbelTextSize,
  | "textSize.small"
  | "textSize.normal"
  | "textSize.large"
  | "textSize.xlarge"
> = {
  small: "textSize.small",
  normal: "textSize.normal",
  large: "textSize.large",
  xlarge: "textSize.xlarge",
};

const ITEM_BASE = "flex items-center gap-3 rounded-xl px-3 py-2";

function matchesPath(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveNav(
  pathname: string,
): (typeof NAV_ITEMS)[number]["id"] | null {
  if (DOSSIER_FUNNEL_PREFIXES.some((prefix) => matchesPath(pathname, prefix))) {
    return "mon-dossier";
  }

  return (
    [...NAV_ITEMS]
      .filter((item) => matchesPath(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.id ?? null
  );
}

export function LandingHeader({ persona, onSearchOpen }: LandingHeaderProps) {
  const t = useTranslations("public.chrome");
  const tAccessibility = useTranslations("public.accessibility");
  const router = useRouter();
  const pathname = usePathname();
  const visible = useScrollReveal();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useAuthSession();
  const siteName = useSiteSettings()?.identity.name ?? "Docbel";
  const activeNav = resolveActiveNav(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const accessibilityPreferences = useSyncExternalStore(
    subscribeAccessibilityPreferences,
    getAccessibilityPreferencesSnapshot,
    getAccessibilityPreferencesServerSnapshot,
  );

  const current = AUDIENCES.find((audience) => audience.id === persona) ?? AUDIENCES[0];
  const PersonaIcon = current.Icon;
  const dark = resolvedTheme === "dark";
  const textSizeIndex = TEXT_SIZE_STEPS.indexOf(accessibilityPreferences.textSize);
  const canDecreaseTextSize = textSizeIndex > 0;
  const canIncreaseTextSize = textSizeIndex < TEXT_SIZE_STEPS.length - 1;

  const userLoggedIn = Boolean(session?.user);
  const userName = session?.user?.name ?? t("guest");
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

  const changeTextSize = (direction: -1 | 1) => {
    const nextTextSize = TEXT_SIZE_STEPS[textSizeIndex + direction];
    if (nextTextSize) {
      updateAccessibilityPreferences({ textSize: nextTextSize });
    }
  };

  const textSizeControls = (
    <div
      role="group"
      aria-label={t("textSizeControls")}
      className="flex items-center gap-1 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => changeTextSize(-1)}
        disabled={!canDecreaseTextSize}
        aria-label={t("decreaseTextSize")}
        title={t("decreaseTextSize")}
        className="size-8 rounded-xl text-base"
      >
        <span aria-hidden>−</span>
      </Button>
      <span className="sr-only">
        {tAccessibility(TEXT_SIZE_KEYS[accessibilityPreferences.textSize])}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => changeTextSize(1)}
        disabled={!canIncreaseTextSize}
        aria-label={t("increaseTextSize")}
        title={t("increaseTextSize")}
        className="size-8 rounded-xl text-base"
      >
        <span aria-hidden>+</span>
      </Button>
    </div>
  );

  const mobileAccessibilityControls = (
    <div className="grid grid-cols-1 gap-2 px-4 pb-5 sm:grid-cols-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setTheme(dark ? "light" : "dark")}
        className="min-h-11 justify-start"
      >
        {dark ? (
          <SunIcon data-icon="inline-start" aria-hidden />
        ) : (
          <MoonIcon data-icon="inline-start" aria-hidden />
        )}
        {t("toggleTheme")}
      </Button>
      <Button
        type="button"
        variant={accessibilityPreferences.highContrast ? "default" : "outline"}
        size="sm"
        aria-pressed={accessibilityPreferences.highContrast}
        onClick={() =>
          updateAccessibilityPreferences({
            highContrast: !accessibilityPreferences.highContrast,
          })
        }
        className="min-h-11 justify-start"
      >
        <ContrastIcon data-icon="inline-start" aria-hidden />
        {tAccessibility("contrast")}
      </Button>
      <Button
        type="button"
        variant={accessibilityPreferences.simpleMode ? "default" : "outline"}
        size="sm"
        aria-pressed={accessibilityPreferences.simpleMode}
        onClick={() =>
          updateAccessibilityPreferences({
            simpleMode: !accessibilityPreferences.simpleMode,
          })
        }
        className="min-h-11 justify-start"
      >
        <GaugeIcon data-icon="inline-start" aria-hidden />
        {tAccessibility("simpleMode")}
      </Button>
      <Button
        type="button"
        variant={accessibilityPreferences.reducedMotion ? "default" : "outline"}
        size="sm"
        aria-pressed={accessibilityPreferences.reducedMotion}
        onClick={() =>
          updateAccessibilityPreferences({
            reducedMotion: !accessibilityPreferences.reducedMotion,
          })
        }
        className="min-h-11 justify-start"
      >
        <PauseIcon data-icon="inline-start" aria-hidden />
        {tAccessibility("reduceMotion")}
      </Button>
    </div>
  );

  return (
    <header
      data-hidden={!visible}
      className="glass-header-shell glass-surface sticky top-3 z-30 flex w-full items-center gap-2 px-3 py-2.5 sm:top-4 sm:gap-3 sm:px-4"
    >
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("menu")}
              className="size-11 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] min-[1180px]:hidden"
            />
          }
        >
          <MenuIcon aria-hidden />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="glass-popup glass-surface-strong gap-0 overflow-y-auto border-r-0 p-0 text-[color:var(--glass-ink)] sm:max-w-sm"
        >
          <SheetHeader className="px-5 py-5">
            <SheetTitle className="text-lg font-extrabold tracking-tight">
              {siteName}
            </SheetTitle>
            <SheetDescription className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-soft)]">
              {current.label}
            </SheetDescription>
          </SheetHeader>
          <Separator className="bg-[color:var(--glass-ink-line)]" />
          <div className="px-4 pt-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setMobileOpen(false);
                onSearchOpen();
              }}
              className="min-h-12 w-full justify-start rounded-2xl"
            >
              <SearchIcon data-icon="inline-start" aria-hidden />
              <span className="truncate">{t("searchPlaceholder")}</span>
            </Button>
          </div>
          <nav aria-label={t("menu")} className="flex flex-col gap-1 p-4">
            {NAV_ITEMS.map((item) => {
              const active = item.id === activeNav;
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]",
                    active
                      ? "bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-ink)] shadow-[inset_0_0_0_1px_var(--glass-border)]"
                      : "text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-surface)] hover:text-[color:var(--glass-ink)]",
                  )}
                >
                  <ItemIcon className="size-4" aria-hidden />
                  {t(item.tKey)}
                </Link>
              );
            })}
          </nav>
          <Separator className="bg-[color:var(--glass-ink-line)]" />
          <div className="p-4">
            <p className="px-3 pb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
              {t("discover")}
            </p>
            {AUDIENCE_NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold outline-none transition-colors hover:bg-[color:var(--glass-surface)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
                >
                  <ItemIcon className="size-4" aria-hidden />
                  {t(item.tKey)}
                </Link>
              );
            })}
            <div className="mt-3 flex items-center justify-between gap-3 px-3">
              <LocaleSwitcher
                localeList={publicLocales}
                className="min-h-11 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3"
              />
              {textSizeControls}
            </div>
          </div>
          <Separator className="bg-[color:var(--glass-ink-line)]" />
          <p className="px-5 pt-4 pb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {tAccessibility("title")}
          </p>
          {mobileAccessibilityControls}
        </SheetContent>
      </Sheet>

      <Link
        href="/"
        aria-label={t("backToHome")}
        className="flex min-w-0 items-center gap-2 rounded-2xl p-1 outline-none transition-colors hover:bg-[color:var(--glass-surface)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[0_4px_16px_color-mix(in_oklab,var(--glass-accent-deep)_35%,transparent)] sm:size-10"
          style={{
            backgroundImage:
              "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-c))",
          }}
        >
          <PersonaIcon className="size-5" aria-hidden />
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-lg font-extrabold tracking-tight">{siteName}</span>
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-soft)]">
            {current.label}
          </span>
        </span>
      </Link>

      <nav
        aria-label={t("menu")}
        className="ml-1 hidden items-center gap-0.5 min-[1180px]:flex"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNav;
          const ItemIcon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]",
                active
                  ? "bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-ink)] shadow-[inset_0_0_0_1px_var(--glass-border)]"
                  : "text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-surface)] hover:text-[color:var(--glass-ink)]",
              )}
            >
              <ItemIcon className="size-3.5" aria-hidden />
              {t(item.tKey)}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onSearchOpen}
        aria-label={t("search")}
        className="search-glow ml-auto flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:bg-[color:var(--glass-surface-strong)] hover:text-[color:var(--glass-ink)] md:min-w-48 md:flex-1 md:justify-start md:gap-2.5 md:px-3 min-[1180px]:max-w-64 min-[1180px]:flex-none"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-left text-[13px] md:block">
          {t("searchPlaceholder")}
        </span>
        <kbd className="hidden shrink-0 rounded-md bg-[color:var(--glass-surface-strong)] px-1.5 py-0.5 text-[10px] font-semibold lg:block">
          ⌘K
        </kbd>
      </button>

      <div className="hidden items-center gap-1.5 md:flex">
        <LocaleSwitcher
          localeList={publicLocales}
          compact
          className="min-h-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-2.5"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="size-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]"
          aria-label={t("toggleTheme")}
        >
          {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={tAccessibility("title")}
                className="size-10 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]"
              />
            }
          >
            <AccessibilityIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-popup glass-surface-strong min-w-64 border-0 p-2 text-[color:var(--glass-ink)]"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 pt-2 pb-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
                {tAccessibility("title")}
              </DropdownMenuLabel>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-sm font-semibold">
                  {tAccessibility(TEXT_SIZE_KEYS[accessibilityPreferences.textSize])}
                </span>
                {textSizeControls}
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-[color:var(--glass-ink-line)]" />
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={accessibilityPreferences.highContrast}
                onCheckedChange={(checked) =>
                  updateAccessibilityPreferences({ highContrast: checked })
                }
                className={ITEM_BASE}
              >
                {tAccessibility("contrast")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={accessibilityPreferences.simpleMode}
                onCheckedChange={(checked) =>
                  updateAccessibilityPreferences({ simpleMode: checked })
                }
                className={ITEM_BASE}
              >
                {tAccessibility("simpleMode")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={accessibilityPreferences.reducedMotion}
                onCheckedChange={(checked) =>
                  updateAccessibilityPreferences({ reducedMotion: checked })
                }
                className={ITEM_BASE}
              >
                {tAccessibility("reduceMotion")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden sm:block">
        <NotificationBell />
      </div>

      {userLoggedIn ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label={t("myAccount")}
                className="size-11 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1 xl:w-auto xl:px-1 xl:pr-3"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback
                className="text-xs font-bold text-primary-foreground"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate text-xs font-bold xl:inline">
              {userName.split(" ")[0]}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="glass-popup glass-surface-strong min-w-56 border-0 p-2 text-[color:var(--glass-ink)]"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 pt-2 pb-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
                {t("myAccount")}
              </DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/profil" />} className={ITEM_BASE}>
                <UserIcon aria-hidden />
                <span className="flex-1 truncate font-semibold">{userName}</span>
              </DropdownMenuItem>
              {userRole === "admin" ? (
                <DropdownMenuItem
                  render={<a href="/admin" target="_blank" rel="noopener noreferrer" />}
                  className={ITEM_BASE}
                >
                  <SettingsIcon aria-hidden />
                  {t("administration")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-[color:var(--glass-ink-line)]" />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleSignOut} className={ITEM_BASE}>
                <LogOutIcon aria-hidden />
                {t("signOut")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          render={<Link href="/login" />}
          nativeButton={false}
          variant="ghost"
          size="icon-lg"
          aria-label={t("signIn")}
          className="size-11 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] lg:w-auto lg:px-3"
        >
          <LogInIcon data-icon="inline-start" aria-hidden />
          <span className="hidden text-xs font-bold lg:inline">{t("signIn")}</span>
        </Button>
      )}
    </header>
  );
}
