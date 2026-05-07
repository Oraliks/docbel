"use client"

import * as React from "react"
import { authClient } from "@/lib/auth-client"
import { useState, useEffect } from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { LayoutDashboardIcon, FolderIcon, UsersIcon, CommandIcon, KeyIcon, NewspaperIcon, MailIcon, Wrench, FileTextIcon } from "lucide-react"
import Link from "next/link"

const defaultData = {
  user: {
    name: "Utilisateur",
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin",
      icon: (
        <LayoutDashboardIcon className="size-4" />
      ),
    },
    {
      title: "Actualités",
      url: "/admin/news",
      icon: (
        <NewspaperIcon className="size-4" />
      ),
      items: [
        {
          title: "Articles",
          url: "/admin/news",
        },
        {
          title: "Catégories",
          url: "/admin/news/categories",
        },
        {
          title: "Statistiques",
          url: "/admin/news/stats",
        },
      ],
    },
    {
      title: "Builder",
      url: "/admin/pages",
      icon: (
        <FolderIcon className="size-4" />
      ),
    },
    {
      title: "Utilisateurs",
      url: "/admin/users",
      icon: (
        <UsersIcon className="size-4" />
      ),
    },
    {
      title: "API Keys",
      url: "/admin?view=api-keys",
      icon: (
        <KeyIcon className="size-4" />
      ),
    },
    {
      title: "Chômage",
      url: "/admin/chomage",
      icon: (
        <Wrench className="size-4" />
      ),
      items: [
        {
          title: "Outils",
          url: "/admin/chomage/outils",
        },
        {
          title: "Préavis",
          url: "/admin/chomage/preavis",
        },
      ],
    },
    {
      title: "Documents",
      url: "/admin/documents",
      icon: (
        <FileTextIcon className="size-4" />
      ),
      items: [
        {
          title: "Modèles",
          url: "/admin/documents",
        },
        {
          title: "Documents générés",
          url: "/admin/documents/generated",
        },
        {
          title: "Statistiques",
          url: "/admin/documents/stats",
        },
        {
          title: "Email",
          url: "/admin/documents/email",
        },
        {
          title: "RGPD",
          url: "/admin/documents/rgpd",
        },
      ],
    },
    {
      title: "Newsletter",
      url: "/admin/newsletter",
      icon: (
        <MailIcon className="size-4" />
      ),
    },
  ],
  navClouds: [],
  navSecondary: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = authClient.useSession()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const response = await fetch("/api/contact-messages")
        if (response.ok) {
          const messages = await response.json()
          const unread = messages.filter((msg: { status: string }) => msg.status === "NEW").length
          setUnreadCount(unread)
        }
      } catch (error) {
        console.error("Failed to fetch unread messages:", error)
      }
    }

    fetchUnreadCount()
  }, [])

  const userData = {
    name: session?.user?.name || defaultData.user.name,
    email: session?.user?.email || defaultData.user.email,
    avatar: defaultData.user.avatar,
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/admin" />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Docbel</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={defaultData.navMain} unreadCount={unreadCount} />
        <NavSecondary items={defaultData.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
