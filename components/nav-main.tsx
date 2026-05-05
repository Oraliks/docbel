"use client"

import Link from "next/link"
import { useState } from "react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import { FolderIcon, Mail, Activity, ScrollIcon, ChevronRight } from "lucide-react"

interface IconItem {
  label: string
  url: string
  icon: React.ReactNode
  badge?: number | null
}

function IconBar({ unreadCount }: { unreadCount: number }) {
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null)

  const icons: IconItem[] = [
    { label: "File Manager", url: "/admin?view=filemanager", icon: <FolderIcon className="h-5 w-5" /> },
    { label: "Messages", url: "/admin/messages", icon: <Mail className="h-5 w-5" />, badge: unreadCount > 0 ? unreadCount : null },
    { label: "Activity", url: "/admin/activity", icon: <Activity className="h-5 w-5" /> },
    { label: "Changelog", url: "/admin/changelog", icon: <ScrollIcon className="h-5 w-5" /> },
  ]

  return (
    <div className="flex justify-around items-center gap-2 px-2 py-3 border-b border-sidebar-border relative z-10">
      {icons.map((item) => (
        <div
          key={item.label}
          className="relative"
          onMouseEnter={() => setHoveredIcon(item.label)}
          onMouseLeave={() => setHoveredIcon(null)}
        >
          <Link
            href={item.url}
            className="flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors inline-flex relative"
          >
            {item.icon}
            {item.badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-semibold">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            )}
          </Link>
          {hoveredIcon === item.label && (
            <div className="fixed px-2 py-1 bg-foreground text-background text-xs rounded whitespace-nowrap z-[9999] pointer-events-none" style={{
              bottom: 'auto',
              top: '0',
              left: '50%',
              transform: 'translateX(-50%) translateY(-100%)',
              marginTop: '-8px'
            }}>
              {item.label}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface NavItem {
  title: string
  url: string
  icon?: React.ReactNode
  items?: {
    title: string
    url: string
  }[]
}

export function NavMain({
  items,
  unreadCount = 0,
}: {
  items: NavItem[]
  unreadCount?: number
}) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const toggleItem = (title: string) => {
    setOpenItems(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    )
  }

  return (
    <SidebarGroup>
      <IconBar unreadCount={unreadCount} />
      <SidebarGroupContent className="flex flex-col gap-2 pt-2">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {item.items && item.items.length > 0 ? (
                <>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="flex items-center gap-2 justify-between"
                    onClick={() => toggleItem(item.title)}
                  >
                    <span className="flex items-center gap-2 flex-1">
                      <span className="flex items-center justify-center size-4">
                        {item.icon}
                      </span>
                      <span>{item.title}</span>
                    </span>
                    <ChevronRight
                      className={`size-4 transition-transform cursor-pointer ${
                        openItems.includes(item.title) ? 'rotate-90' : ''
                      }`}
                    />
                  </SidebarMenuButton>
                  {openItems.includes(item.title) && (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton render={<Link href={subItem.url} />}>
                            {subItem.title}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </>
              ) : (
                <SidebarMenuButton tooltip={item.title} className="flex items-center gap-2" render={<Link href={item.url} />}>
                  <span className="flex items-center justify-center size-4">
                    {item.icon}
                  </span>
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
