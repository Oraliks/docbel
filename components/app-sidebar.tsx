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
import { FolderIcon, CommandIcon, NewspaperIcon, MailIcon, Wrench, FileTextIcon, HandshakeIcon, MapPinIcon, FileInputIcon } from "lucide-react"
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
          children: [
            { title: "Calculateurs", url: "/admin/chomage/outils/calculateurs" },
            { title: "Barèmes officiels", url: "/admin/baremes" },
            { title: "Commissions paritaires", url: "/admin/commissions" },
            { title: "Institutions U1 (EEE)", url: "/admin/u1-institutions" },
          ],
        },
        {
          title: "Lookup ONEM",
          url: "/admin/chomage/lookup",
          children: [
            { title: "Tables", url: "/admin/chomage/lookup" },
            { title: "Recherche", url: "/admin/chomage/lookup?tab=search" },
            { title: "Statistiques", url: "/admin/chomage/lookup?tab=stats" },
            { title: "Anomalies", url: "/admin/chomage/lookup?tab=anomalies" },
            { title: "Import en lot", url: "/admin/chomage/lookup?tab=import" },
          ],
        },
        {
          // Assistant IA : knowledge base + chat sourcé + générateur de
          // prompts Claude Code. URL volontairement neutre — l'auth admin
          // est validée à l'intérieur de chaque page (cf. principe Beldoc
          // "URLs conditionnées par l'auth, pas par le path").
          title: "Assistant IA",
          url: "/admin/chomage/ia",
          children: [
            // Ordre par fréquence d'usage : opérationnel quotidien d'abord
            // (Chat, Sources, Veille), supervision ensuite (Gaps, Mémoire),
            // outils ponctuels en bas (Prompts).
            { title: "Chat", url: "/admin/chomage/ia/chat" },
            { title: "Sources", url: "/admin/chomage/ia/sources" },
            { title: "Veille", url: "/admin/chomage/ia/ingestion" },
            { title: "Gaps", url: "/admin/chomage/ia/gaps" },
            { title: "Mémoire", url: "/admin/chomage/ia/memory" },
            { title: "Prompts", url: "/admin/chomage/ia/prompt-builder" },
          ],
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
          title: "Configurations",
          url: "/admin/documents/config",
          children: [
            { title: "Sections", url: "/admin/documents/config" },
            { title: "Organismes", url: "/admin/documents/config?tab=organismes" },
            { title: "Presets validation", url: "/admin/documents/config?tab=presets" },
            { title: "Bundles", url: "/admin/documents/config?tab=bundles" },
          ],
        },
        {
          title: "Documents générés",
          url: "/admin/documents/generated",
        },
        {
          title: "Analytics",
          url: "/admin/documents/analytics",
        },
        {
          title: "Paramètres système",
          url: "/admin/documents/settings",
        },
      ],
    },
    {
      title: "PDF Forms",
      url: "/admin/pdf",
      icon: (
        <FileInputIcon className="size-4" />
      ),
      items: [
        { title: "Tous les formulaires", url: "/admin/pdf" },
        { title: "Nouveau formulaire", url: "/admin/pdf/new" },
        { title: "Presets de champs", url: "/admin/pdf/presets" },
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
      title: "Bureaux",
      url: "/admin/bureaux",
      icon: (
        <MapPinIcon className="size-4" />
      ),
      items: [
        {
          title: "Santé des données",
          url: "/admin/bureaux#sante",
        },
        {
          title: "Aperçu user",
          url: "/admin/bureaux#preview",
        },
        {
          title: "Annuaire",
          url: "/admin/bureaux#annuaire",
        },
        {
          title: "Compétences territoriales",
          url: "/admin/bureaux#services",
        },
        {
          title: "Compétences ONEM",
          url: "/admin/bureaux#onem",
        },
        {
          title: "Signalements",
          url: "/admin/bureaux#reports",
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
