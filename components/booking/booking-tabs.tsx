"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface BookingTabsProps {
  tenantId: string;
  role: "owner" | "manager" | "agent";
  /** Préfixe d'URL : "/partenaire/booking" (pro) ou "/admin/booking" (admin). */
  basePath: string;
}

export function BookingTabs({ tenantId, role, basePath }: BookingTabsProps) {
  const pathname = usePathname();
  const base = `${basePath}/${tenantId}`;

  const tabs = [
    { label: "Agenda", href: `${base}/agenda` },
    { label: "Créneaux", href: `${base}/creneaux` },
    { label: "Exceptions", href: `${base}/exceptions` },
    { label: "Statistiques", href: `${base}/stats` },
    ...(role === "owner"
      ? [
          { label: "Configuration", href: `${base}/configuration` },
          { label: "Équipe", href: `${base}/equipe` },
        ]
      : []),
  ];

  return (
    <div className="border-b">
      <nav className="flex gap-0 overflow-x-auto px-4 lg:px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
