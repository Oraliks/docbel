"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { ActivityIcon, FlagIcon, FolderIcon, MailIcon, ScrollTextIcon, ChevronRightIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react"
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

interface NavSubItem {
  title: string
  url: string
  /// Sous-éléments imbriqués (3e niveau, optionnel).
  children?: { title: string; url: string }[]
}

interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  items?: NavSubItem[]
}

const QUICK_LINKS = [
  { label: "Dashboard", url: "/admin", icon: LayoutDashboardIcon },
  { label: "Utilisateurs", url: "/admin/users", icon: UsersIcon },
  { label: "Fichiers", url: "/admin?view=filemanager", icon: FolderIcon },
  { label: "Messagerie", url: "/admin/messagerie", icon: MailIcon },
  { label: "Signalements", url: "/admin/signalements", icon: FlagIcon },
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
  pendingReportsCount = 0,
}: {
  items: NavItem[]
  unreadCount?: number
  pendingReportsCount?: number
}) {
  const isActive = useIsQuickLinkActive()
  // Seed : ouvre d'emblée le(s) groupe(s) contenant la route active pour que
  // l'utilisateur voie où il se trouve dès le premier rendu. Initializer lazy
  // (s'exécute une fois au montage) → pas de setState en effect (règle ESLint
  // react-hooks/set-state-in-effect du projet).
  const [openItems, setOpenItems] = useState<string[]>(() => {
    const open: string[] = []
    for (const item of items) {
      if (!item.items?.length) continue
      let groupOpen = false
      for (const sub of item.items) {
        const childActive = sub.children?.some((leaf) => isActive(leaf.url)) ?? false
        if (isActive(sub.url) || childActive) {
          groupOpen = true
          if (childActive) open.push(`${item.title}::${sub.title}`)
        }
      }
      if (groupOpen) open.push(item.title)
    }
    return open
  })

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
              const badgeCount = item.label === "Messagerie" ? unreadCount : item.label === "Signalements" ? pendingReportsCount : 0
              const showBadge = badgeCount > 0
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
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    ) : null}
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {showBadge ? `${item.label} · ${badgeCount} non lu${badgeCount > 1 ? "s" : ""}` : item.label}
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
                        {item.items.map((subItem) => {
                          const subKey = `${item.title}::${subItem.title}`;
                          const hasChildren = subItem.children && subItem.children.length > 0;
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              {hasChildren ? (
                                <>
                                  {/* Le label est cliquable pour naviguer, le chevron pour expand */}
                                  <div className="flex items-stretch gap-0.5">
                                    <SidebarMenuSubButton
                                      render={<Link href={subItem.url} />}
                                      isActive={isActive(subItem.url)}
                                      className="flex-1"
                                    >
                                      {subItem.title}
                                    </SidebarMenuSubButton>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleItem(subKey);
                                      }}
                                      aria-label={
                                        openItems.includes(subKey)
                                          ? `Réduire ${subItem.title}`
                                          : `Développer ${subItem.title}`
                                      }
                                      className="px-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      <ChevronRightIcon
                                        className={`size-3 transition-transform ${openItems.includes(subKey) ? "rotate-90" : ""}`}
                                      />
                                    </button>
                                  </div>
                                  {openItems.includes(subKey) && (
                                    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
                                      {subItem.children!.map((leaf) => (
                                        <li key={leaf.title}>
                                          <SidebarMenuSubButton
                                            render={<Link href={leaf.url} />}
                                            isActive={isActive(leaf.url)}
                                            className="text-xs"
                                          >
                                            {leaf.title}
                                          </SidebarMenuSubButton>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              ) : (
                                <SidebarMenuSubButton
                                  render={<Link href={subItem.url} />}
                                  isActive={isActive(subItem.url)}
                                >
                                  {subItem.title}
                                </SidebarMenuSubButton>
                              )}
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </>
                ) : (
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="flex items-center gap-2"
                    render={<Link href={item.url} />}
                    isActive={isActive(item.url)}
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
