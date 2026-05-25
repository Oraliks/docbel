'use client'

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useAuthSession } from "@/components/auth-session-provider"
import { useTheme } from "@/components/theme-provider"
import { HomeIcon, MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const emptySubscribe = () => () => {}

export function SiteHeader() {
  const router = useRouter()
  const { data: session } = useAuthSession()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const isDark = mounted && resolvedTheme === "dark"
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <ShieldCheckIcon data-icon="inline-start" />
            Admin
          </Badge>
        </div>

        <TooltipProvider>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    disabled={!mounted}
                  />
                }
              >
                {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <span className="size-4" />}
                <span className="sr-only">Changer le theme</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isDark ? "Mode clair" : "Mode sombre"}
              </TooltipContent>
            </Tooltip>

            {session && (
              <>
                <Link
                  href="/"
                  title="Aller à l'accueil"
                  className="inline-flex size-7 items-center justify-center rounded-[min(var(--radius-md),12px)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <HomeIcon />
                  <span className="sr-only">Aller à l&apos;accueil</span>
                </Link>

                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Deconnexion
                </Button>
              </>
            )}
          </div>
        </TooltipProvider>
      </div>
    </header>
  )
}
