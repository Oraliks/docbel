"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages, BookMarked, MessagesSquare } from "lucide-react";

const TABS = [
  {
    href: "/admin/i18n/nl",
    label: "Traductions",
    icon: Languages,
    match: (p: string) =>
      p === "/admin/i18n" || /^\/admin\/i18n\/(nl|en|de|ar|tr|ro|bg)$/.test(p),
  },
  {
    href: "/admin/i18n/glossaire",
    label: "Glossaire",
    icon: BookMarked,
    match: (p: string) => p.startsWith("/admin/i18n/glossaire"),
  },
  {
    href: "/admin/i18n/suggestions",
    label: "Corrections",
    icon: MessagesSquare,
    match: (p: string) => p.startsWith("/admin/i18n/suggestions"),
  },
];

export function I18nTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b px-4 lg:px-6">
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
