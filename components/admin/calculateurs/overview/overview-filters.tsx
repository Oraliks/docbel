"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReliabilityFilter } from "./types";

interface OverviewFiltersProps {
  selected: ReliabilityFilter;
  onSelectedChange: (value: ReliabilityFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  counts: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

interface TabDef {
  id: ReliabilityFilter;
  label: string;
  tone: "violet" | "emerald" | "amber" | "red";
}

const TONE_ACTIVE: Record<TabDef["tone"], string> = {
  violet:
    "bg-primary/10 text-primary border-primary/30 dark:bg-primary/15",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-500/10 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
};

/**
 * Barre de filtres pour la page d'overview admin des calculateurs.
 *
 * À gauche : 4 tabs filtrables par niveau de fiabilité (Tous / Fiables /
 * Approximatifs / À vérifier). Chaque tab affiche son compteur, et prend
 * une couleur teintée quand actif.
 *
 * À droite : champ de recherche full-text (match titre + pitch).
 *
 * Layout responsive : sur mobile la search bar passe sous les tabs en
 * largeur pleine.
 */
export function OverviewFilters({
  selected,
  onSelectedChange,
  search,
  onSearchChange,
  counts,
}: OverviewFiltersProps) {
  const tabs: TabDef[] = [
    { id: "all", label: `Tous (${counts.total})`, tone: "violet" },
    { id: "high", label: `Fiables (${counts.high})`, tone: "emerald" },
    {
      id: "medium",
      label: `Approximatifs (${counts.medium})`,
      tone: "amber",
    },
    { id: "low", label: `À vérifier (${counts.low})`, tone: "red" },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Filtres calculateurs"
      className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
    >
      {/* Tabs --------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Filtrer par fiabilité"
        className="flex flex-wrap items-center gap-1.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectedChange(tab.id)}
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
          aria-label="Rechercher un calculateur"
          placeholder="Rechercher un calculateur..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9"
        />
      </div>
    </div>
  );
}
