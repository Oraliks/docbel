"use client"

import Link from "next/link"
import { useState } from "react"
import { ActivityIcon, FolderIcon, MailIcon, ScrollTextIcon, ChevronRightIcon } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

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
  { label: "Fichiers", url: "/admin?view=filemanager", icon: FolderIcon },
  { label: "Messages", url: "/admin/messages", icon: MailIcon },
  { label: "Activite", url: "/admin/activity", icon: ActivityIcon },
  { label: "Changelog", url: "/admin/changelog", icon: ScrollTextIcon },
]

export function NavMain({
  items,
  unreadCount = 0,
}: {
  items: NavItem[]
  unreadCount?: number
}) {
  const [openItems, setOpenItems] = useState<string[]>([])

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
        <SidebarGroupLabel>Acces rapides</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {QUICK_LINKS.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton render={<Link href={item.url} />} tooltip={item.label}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                {item.label === "Messages" && unreadCount > 0 ? (
                  <SidebarMenuBadge>{unreadCount > 9 ? "9+" : unreadCount}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
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
