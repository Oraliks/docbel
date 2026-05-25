'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthSession } from "@/components/auth-session-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export function AdminLayoutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useAuthSession()
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
        <ConfirmDialog />
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
      <ConfirmDialog />
    </TooltipProvider>
  )
}
