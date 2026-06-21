"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useAuthSession } from "@/components/auth-session-provider"
import { useState, useEffect } from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { LocaleSwitcher } from "@/components/locale-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { FolderIcon, CommandIcon, NewspaperIcon, MailIcon, Wrench, MapPinIcon, FileInputIcon, UsersIcon, CalendarClock, BriefcaseIcon, GraduationCapIcon, ImageIcon, GitBranchIcon } from "lucide-react"
import Link from "next/link"

const defaultUser = {
  name: "Utilisateur",
  email: "user@example.com",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // useAuthSession() (vs authClient.useSession direct) garde initialSession
  // en fallback quand le re-fetch client échoue — sinon le footer affiche
  // "Utilisateur user@example.com" à chaque refresh rapide / cold-start Neon.
  const { data: session } = useAuthSession()
  const t = useTranslations("admin.nav")
  const [unreadCount, setUnreadCount] = useState(0)

  // Construit dans le composant pour pouvoir traduire les libellés via t().
  const navMain = [
    {
      title: t("actualites"),
      url: "/admin/news",
      icon: <NewspaperIcon className="size-4" />,
      items: [
        { title: t("articles"), url: "/admin/news" },
        { title: t("categories"), url: "/admin/news/categories" },
        { title: t("stats"), url: "/admin/news/stats" },
      ],
    },
    {
      title: t("builder"),
      url: "/admin/pages",
      icon: <FolderIcon className="size-4" />,
    },
    {
      title: t("chomage"),
      url: "/admin/chomage",
      icon: <Wrench className="size-4" />,
      items: [
        {
          title: t("outils"),
          url: "/admin/chomage/outils",
          children: [
            { title: t("calculateurs"), url: "/admin/chomage/outils/calculateurs" },
            { title: t("baremes"), url: "/admin/baremes" },
            { title: t("commissions"), url: "/admin/commissions" },
            { title: t("u1"), url: "/admin/u1-institutions" },
          ],
        },
        {
          title: t("lookup"),
          url: "/admin/chomage/lookup",
          children: [
            { title: t("tables"), url: "/admin/chomage/lookup" },
            { title: t("recherche"), url: "/admin/chomage/lookup?tab=search" },
            { title: t("stats"), url: "/admin/chomage/lookup?tab=stats" },
            { title: t("anomalies"), url: "/admin/chomage/lookup?tab=anomalies" },
            { title: t("importBulk"), url: "/admin/chomage/lookup?tab=import" },
          ],
        },
        {
          // Assistant IA : knowledge base + chat sourcé + générateur de
          // prompts Claude Code. URL volontairement neutre — l'auth admin
          // est validée à l'intérieur de chaque page (cf. principe Beldoc
          // "URLs conditionnées par l'auth, pas par le path").
          title: t("assistantIa"),
          url: "/admin/chomage/ia",
          children: [
            // Ordre par fréquence d'usage : opérationnel quotidien d'abord
            // (Chat, Sources, Veille), supervision ensuite (Gaps, Mémoire),
            // outils ponctuels en bas (Prompts).
            { title: t("chat"), url: "/admin/chomage/ia/chat" },
            { title: t("sources"), url: "/admin/chomage/ia/sources" },
            { title: t("veille"), url: "/admin/chomage/ia/ingestion" },
            { title: t("gaps"), url: "/admin/chomage/ia/gaps" },
            { title: t("memoire"), url: "/admin/chomage/ia/memory" },
            { title: t("prompts"), url: "/admin/chomage/ia/prompt-builder" },
          ],
        },
      ],
    },
    {
      // Tout ce qui touche aux formulaires PDF + dossiers vit sous /admin/pdf/.
      title: t("pdfForms"),
      url: "/admin/pdf",
      icon: <FileInputIcon className="size-4" />,
      items: [
        { title: t("pdfAll"), url: "/admin/pdf" },
        { title: t("pdfNew"), url: "/admin/pdf/new" },
        { title: t("dossiers"), url: "/admin/pdf/dossiers" },
        { title: t("organismes"), url: "/admin/pdf/organismes" },
        { title: t("presets"), url: "/admin/pdf/presets" },
        { title: t("acroformSources"), url: "/admin/pdf-sources" },
      ],
    },
    {
      // Decision Builder : arbres d'orientation versionnés vers les dossiers.
      // Libellé en dur (pas de clé i18n) — module récent.
      title: "Decision Builder",
      url: "/admin/decision-trees",
      icon: <GitBranchIcon className="size-4" />,
    },
    {
      title: t("comptesAcces"),
      url: "/admin/users",
      icon: <UsersIcon className="size-4" />,
      items: [
        { title: t("utilisateurs"), url: "/admin/users" },
        {
          title: t("partenaires"),
          url: "/admin/partenaires",
          children: [
            { title: t("domainesAutorises"), url: "/admin/partenaires" },
            { title: t("stats"), url: "/admin/partenaires/stats" },
            { title: t("emailInvitation"), url: "/admin/partenaires/email" },
          ],
        },
        {
          title: t("employeurs"),
          url: "/admin/employeurs",
          children: [
            { title: t("accesAutorises"), url: "/admin/employeurs" },
            { title: t("stats"), url: "/admin/employeurs/stats" },
            { title: t("emailInvitation"), url: "/admin/employeurs/email" },
          ],
        },
        {
          // Audit des impersonations admin (cf. AdminImpersonationLog,
          // alimenté par /api/admin/impersonate et /api/admin/view-as-visitor).
          title: t("auditImpersonations"),
          url: "/admin/impersonation",
        },
      ],
    },
    {
      // Assistant administratif employeur (sources officielles + moteur de
      // règles déterministe). Libellés en dur (pas de clés i18n) pour le MVP.
      title: "Assistant Employeur",
      url: "/admin/employeur/sources",
      icon: <BriefcaseIcon className="size-4" />,
      items: [
        { title: "Sources officielles", url: "/admin/employeur/sources" },
        { title: "Règles métier", url: "/admin/employeur/regles" },
      ],
    },
    {
      title: t("bureaux"),
      url: "/admin/bureaux",
      icon: <MapPinIcon className="size-4" />,
      items: [
        { title: t("santeDonnees"), url: "/admin/bureaux#sante" },
        { title: t("apercuUser"), url: "/admin/bureaux#preview" },
        { title: t("annuaire"), url: "/admin/bureaux#annuaire" },
        { title: t("competencesTerritoriales"), url: "/admin/bureaux#services" },
        { title: t("competencesOnem"), url: "/admin/bureaux#onem" },
        { title: t("signalements"), url: "/admin/bureaux#reports" },
      ],
    },
    {
      // Module Docbel Formations : catalogue, modération, taxonomie, permissions.
      title: t("formations"),
      url: "/admin/formations",
      icon: <GraduationCapIcon className="size-4" />,
      items: [
        { title: t("formationsOverview"), url: "/admin/formations" },
        { title: t("formationsModule"), url: "/admin/modules/formations" },
        { title: t("formationsValidation"), url: "/admin/formations/validation" },
        { title: t("formationsPermissions"), url: "/admin/formations/permissions" },
        { title: t("formationsCategories"), url: "/admin/formations/categories" },
        { title: t("formationsSignalements"), url: "/admin/formations/signalements" },
        { title: t("formationsBoussole"), url: "/admin/formations/boussole" },
      ],
    },
    {
      // Plateforme de prise de RDV (multi-tenant) + outil privé FGTB (.ics).
      title: t("rendezVous"),
      url: "/admin/booking",
      icon: <CalendarClock className="size-4" />,
      items: [
        { title: t("plateformeBooking"), url: "/admin/booking" },
        { title: t("planningFgtb"), url: "/partenaire/outils/fgtb-planning" },
      ],
    },
    {
      title: t("newsletter"),
      url: "/admin/newsletter",
      icon: <MailIcon className="size-4" />,
    },
    {
      // Santé des médias : scan des images cassées (link-rot) sur toute la
      // base. Libellé en dur (pas de clé i18n) — page de maintenance interne.
      title: "Médias",
      url: "/admin/medias",
      icon: <ImageIcon className="size-4" />,
    },
  ]

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
    name: session?.user?.name || defaultUser.name,
    email: session?.user?.email || defaultUser.email,
    avatar: defaultUser.avatar,
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
        <NavMain items={navMain} unreadCount={unreadCount} />
        <NavSecondary items={[]} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <LocaleSwitcher />
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
