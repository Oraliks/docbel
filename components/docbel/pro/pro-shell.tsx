"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2Icon,
  HandshakeIcon,
  HomeIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { useAuthSession } from "@/components/auth-session-provider";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProSegment } from "@/lib/pro-nav";
import { ProSidebar } from "./pro-sidebar";

const emptySubscribe = () => () => {};

/**
 * Shell de l'espace Dashboard pro (partenaires + employeurs) — sidebar +
 * topbar, calqué sur le shell `/admin`. Rendu par `AppLayoutClient` quand un
 * pro connecté visite son espace (cf. `resolveProSegment`).
 */
export function ProShell({
  segment,
  children,
}: {
  segment: ProSegment;
  children: React.ReactNode;
}) {
  const { data: session } = useAuthSession();
  const user = {
    name: session?.user?.name ?? "Compte",
    email: session?.user?.email ?? "",
    avatar: "",
  };

  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <ProSidebar segment={segment} user={user} />
        <SidebarInset>
          <ProTopbar segment={segment} />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function ProTopbar({ segment }: { segment: ProSegment }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === "dark";

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  const SegmentIcon = segment === "partenaire" ? HandshakeIcon : Building2Icon;
  const label = segment === "partenaire" ? "Espace Partenaire" : "Espace Employeur";

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <SegmentIcon data-icon="inline-start" />
            {label}
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            disabled={!mounted}
            aria-label="Changer le thème"
          >
            {mounted ? (
              isDark ? (
                <SunIcon />
              ) : (
                <MoonIcon />
              )
            ) : (
              <span className="size-4" />
            )}
          </Button>

          <Link
            href="/"
            title="Aller à l'accueil"
            className="inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HomeIcon className="size-4" />
            <span className="sr-only">Aller à l&apos;accueil</span>
          </Link>

          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Déconnexion
          </Button>
        </div>
      </div>
    </header>
  );
}
