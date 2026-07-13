"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Building2, Eye, Handshake, Users } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ComptesTabCounts {
  users?: number
  partenaires?: number
  employeurs?: number
}

const TABS: Array<{
  href: string
  labelKey: "tabUsers" | "tabPartenaires" | "tabEmployeurs" | "tabAudit"
  icon: React.ComponentType<{ className?: string }>
  countKey?: keyof ComptesTabCounts
}> = [
  { href: "/admin/users", labelKey: "tabUsers", icon: Users, countKey: "users" },
  {
    href: "/admin/partenaires",
    labelKey: "tabPartenaires",
    icon: Handshake,
    countKey: "partenaires",
  },
  {
    href: "/admin/employeurs",
    labelKey: "tabEmployeurs",
    icon: Building2,
    countKey: "employeurs",
  },
  { href: "/admin/impersonation", labelKey: "tabAudit", icon: Eye },
]

/// Bandeau d'onglets partagé du hub « Comptes & accès », posé en tête des 4
/// pages (users / partenaires / employeurs / audit impersonations). Ne déplace
/// AUCUNE route : chaque onglet est un simple lien vers la page existante.
/// L'onglet actif est déduit du pathname (préfixe). Les compteurs sont
/// optionnels (fournis par la page qui a déjà chargé la donnée).
export function ComptesTabs({ counts }: { counts?: ComptesTabCounts }) {
  const pathname = usePathname()
  const t = useTranslations("admin.comptes")

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b px-4 lg:px-6">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin/users"
            ? pathname === "/admin/users" || pathname.startsWith("/admin/users/")
            : pathname.startsWith(tab.href)
        const Icon = tab.icon
        const count = tab.countKey ? counts?.[tab.countKey] : undefined
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(tab.labelKey)}
            {typeof count === "number" && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-px text-[11px] tabular-nums",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
