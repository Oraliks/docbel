'use client'

import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useAuthSession } from "@/components/auth-session-provider"
import { HomeIcon, ShieldCheckIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  const router = useRouter()
  const { data: session } = useAuthSession()

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

        <div className="ml-auto flex items-center gap-2">
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
      </div>
    </header>
  )
}
