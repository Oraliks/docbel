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
import { FolderIcon, CommandIcon, NewspaperIcon, MailIcon, Wrench, FileTextIcon, HandshakeIcon } from "lucide-react"
import Link from "next/link"

const defaultData = {
  user: {
    name: "Utilisateur",
    email: "user@example.com",
    avatar: "",
  },
  navMain: [
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
        {
          title: "Commissions paritaires",
          url: "/admin/commissions",
        },
        {
          title: "Institutions U1 (EEE)",
          url: "/admin/u1-institutions",
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
      title: "Partenaires",
      url: "/admin/partenaires",
      icon: (
        <HandshakeIcon className="size-4" />
      ),
      items: [
        {
          title: "Domaines autorisés",
          url: "/admin/partenaires",
        },
        {
          title: "Statistiques",
          url: "/admin/partenaires/stats",
        },
        {
          title: "Email d'invitation",
          url: "/admin/partenaires/email",
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
    let cancelled = false
    async function fetchUnreadCount() {
      try {
        const response = await fetch("/api/inbox/stats")
        if (cancelled) return
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.unreadInbox || 0)
        }
      } catch (error) {
        console.error("Failed to fetch unread messages:", error)
      }
    }

    void fetchUnreadCount()

    // Refresh every 30s while the tab is visible
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchUnreadCount()
    }, 30_000)

    // Refresh when the tab regains focus
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchUnreadCount()
    }
    document.addEventListener("visibilitychange", onVisibility)

    // Refresh on demand — the messagerie panel dispatches this when state changes,
    // so the badge updates instantly without waiting for the polling interval.
    const onStatsChanged = () => void fetchUnreadCount()
    window.addEventListener("inbox:stats-changed", onStatsChanged)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("inbox:stats-changed", onStatsChanged)
    }
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
