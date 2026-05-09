'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from "@/lib/auth-client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AdminLayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const isBuilder = /^\/admin\/pages\/[^/]+$/.test(pathname ?? '')

  useEffect(() => {
    if (!isPending && !session) {
      router.replace('/')
    }
  }, [session, isPending, router])

  if (!isPending && !session) {
    return null
  }

  if (isBuilder) {
    return (
      <TooltipProvider>
        {children}
      </TooltipProvider>
    )
  }

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
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
