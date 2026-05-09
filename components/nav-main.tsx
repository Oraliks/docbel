"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { ActivityIcon, FolderIcon, MailIcon, ScrollTextIcon, ChevronRightIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  items?: {
    title: string
    url: string
  }[]
}

const QUICK_LINKS = [
  { label: "Dashboard", url: "/admin", icon: LayoutDashboardIcon },
  { label: "Utilisateurs", url: "/admin/users", icon: UsersIcon },
  { label: "Fichiers", url: "/admin?view=filemanager", icon: FolderIcon },
  { label: "Messagerie", url: "/admin/messagerie", icon: MailIcon },
  { label: "Activité", url: "/admin/activity", icon: ActivityIcon },
  { label: "Changelog", url: "/admin/changelog", icon: ScrollTextIcon },
]

function useIsQuickLinkActive() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (url: string) => {
    const [basePath, queryString] = url.split("?")
    if (queryString) {
      if (pathname !== basePath) return false
      const params = new URLSearchParams(queryString)
      for (const [key, value] of params.entries()) {
        if (searchParams?.get(key) !== value) return false
      }
      return true
    }
    // /admin matches every admin route via startsWith — so for the dashboard
    // tile specifically, require an exact match AND no `view` query (which
    // would mean the Files tile is active instead).
    if (basePath === "/admin") {
      return pathname === basePath && !searchParams?.get("view")
    }
    return pathname === basePath || pathname?.startsWith(`${basePath}/`)
  }
}

export function NavMain({
  items,
  unreadCount = 0,
}: {
  items: NavItem[]
  unreadCount?: number
}) {
  const [openItems, setOpenItems] = useState<string[]>([])
  const isActive = useIsQuickLinkActive()

  const toggleItem = (title: string) => {
    setOpenItems((previous) =>
      previous.includes(title)
        ? previous.filter((value) => value !== title)
        : [...previous, title]
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <SidebarGroup>
        <SidebarGroupLabel>Accès rapides</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex items-center gap-1.5 px-1">
            {QUICK_LINKS.map((item) => {
              const active = isActive(item.url)
              const showBadge = item.label === "Messagerie" && unreadCount > 0
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={item.url}
                        aria-label={item.label}
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          active &&
                            "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        )}
                      />
                    }
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute -left-1 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                      />
                    ) : null}
                    <item.icon className="size-4" />
                    {showBadge ? (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground tabular-nums">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {showBadge ? `${item.label} · ${unreadCount} non lu${unreadCount > 1 ? "s" : ""}` : item.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.items && item.items.length > 0 ? (
                  <>
                    <SidebarMenuButton
                      tooltip={item.title}
                      className="justify-between"
                      onClick={() => toggleItem(item.title)}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex items-center justify-center size-4">{item.icon}</span>
                        <span>{item.title}</span>
                      </span>
                      <ChevronRightIcon
                        className={`transition-transform ${openItems.includes(item.title) ? "rotate-90" : ""}`}
                      />
                    </SidebarMenuButton>

                    {openItems.includes(item.title) && (
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton render={<Link href={subItem.url} />} isActive={false}>
                              {subItem.title}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="flex items-center gap-2"
                    render={<Link href={item.url} />}
                  >
                    <span className="flex items-center justify-center size-4">{item.icon}</span>
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  )
}
