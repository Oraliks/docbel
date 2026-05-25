"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PartnerCounts, PartnerStatusFilter } from "./types";

interface PartnerOverviewFiltersProps {
  status: PartnerStatusFilter;
  onStatusChange: (value: PartnerStatusFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  counts: PartnerCounts;
  testCount: number;
}

interface TabDef {
  id: PartnerStatusFilter;
  label: string;
  tone: "violet" | "emerald" | "amber" | "red" | "slate";
}

const TONE_ACTIVE: Record<TabDef["tone"], string> = {
  violet: "bg-primary/10 text-primary border-primary/30 dark:bg-primary/15",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-500/10 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  slate:
    "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
};

/**
 * Barre de filtres pour la page d'overview admin /admin/partenaires.
 *
 * Layout responsive — mobile : empilé / desktop : tabs à gauche, search à droite.
 * Pattern aligné sur `news-overview-filters.tsx` et `tools-admin/filters-bar.tsx`.
 *
 *   - Tabs (Toutes / Actives / En attente / Inactives / Test) : chaque tab
 *     affiche son compteur et prend une teinte colorée quand actif.
 *   - Search bar : match nom de l'organisation + domaine + email/nom user
 *     (côté shell).
 */
export function PartnerOverviewFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
  counts,
  testCount,
}: PartnerOverviewFiltersProps) {
  const tabs: TabDef[] = [
    { id: "all", label: `Toutes (${counts.total})`, tone: "violet" },
    { id: "active", label: `Actives (${counts.active})`, tone: "emerald" },
    { id: "pending", label: `En attente (${counts.pending})`, tone: "amber" },
    { id: "inactive", label: `Inactives (${counts.inactive})`, tone: "red" },
    { id: "test", label: `Test (${testCount})`, tone: "slate" },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Filtres organisations partenaires"
      className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
    >
      {/* Tabs --------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Filtrer par statut"
        className="flex flex-wrap items-center gap-1.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === status;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onStatusChange(tab.id)}
              className={cn(
                "inline-flex items-center rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                isActive
                  ? TONE_ACTIVE[tab.tone]
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Recherche ---------------------------------------------------- */}
      <div className="relative w-full lg:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Rechercher une organisation"
          placeholder="Nom, domaine ou email..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9"
        />
      </div>
    </div>
  );
}
