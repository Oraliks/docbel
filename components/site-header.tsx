'use client'

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { HomeIcon, MoonIcon, SunIcon } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function SiteHeader() {
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />

        <TooltipProvider>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={() => setTheme(isDark ? "light" : "dark")}
                    disabled={!mounted}
                    className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none"
                  />
                }
              >
                {mounted ? (
                  isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />
                ) : (
                  <span className="size-4" />
                )}
                <span className="sr-only">Changer le thème</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {isDark ? "Mode clair" : "Mode sombre"}
              </TooltipContent>
            </Tooltip>

            {session && (
              <>
                <Tooltip>
                  <TooltipTrigger render={<a href="/" />} className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <HomeIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Aller à l'accueil</TooltipContent>
                </Tooltip>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Déconnexion
                </Button>
              </>
            )}
          </div>
        </TooltipProvider>
      </div>
    </header>
  )
}
