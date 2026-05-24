"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface MethodologyTabSpec {
  /** Identifiant unique (search param value). */
  id: string;
  /** Label affiché dans la nav. */
  label: string;
  /** Compteur optionnel affiché en exposant (ex: "PDFs (7)"). */
  count?: number;
}

interface MethodologyTabsProps {
  /** Onglet actif courant. */
  activeTab: string;
  /** Spécification des onglets. */
  tabs: MethodologyTabSpec[];
}

/**
 * Tabs nav avec underline sur l'onglet actif. Client component léger :
 * on ne stocke pas de state local — on construit des `<Link>` avec
 * `?tab=...` pour permettre le deep-link et le partage d'URL. La page
 * server-side lit `searchParams.tab` et rend la bonne section.
 */
export function MethodologyTabs({ activeTab, tabs }: MethodologyTabsProps) {
  const pathname = usePathname();
  const search = useSearchParams();

  function urlForTab(id: string) {
    // Préserve les autres search params si présents.
    const params = new URLSearchParams(search.toString());
    if (id === "apercu") {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav
      role="tablist"
      aria-label="Sections de la méthodologie"
      className="-mx-1 flex flex-wrap items-end gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Link
            key={tab.id}
            href={urlForTab(tab.id)}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {/* Underline */}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                isActive ? "bg-primary" : "bg-transparent",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
