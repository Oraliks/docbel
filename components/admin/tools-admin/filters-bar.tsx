"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Section, StatusFilter } from "./types";

interface FiltersBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  counts: {
    total: number;
    active: number;
    inactive: number;
    popular: number;
  };
  sections: Section[];
}

interface TabDef {
  id: StatusFilter;
  label: string;
  tone: "violet" | "emerald" | "red" | "amber";
}

const TONE_ACTIVE: Record<TabDef["tone"], string> = {
  violet:
    "bg-primary/10 text-primary border-primary/30 dark:bg-primary/15",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  red: "bg-red-500/10 text-red-700 border-red-500/30 dark:bg-red-500/15 dark:text-red-300",
  amber:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
};

/**
 * Barre de filtres pour /admin/chomage/outils.
 *
 * Layout responsive — mobile : empilé / desktop : tabs à gauche, search +
 * catégorie à droite.
 *
 *   - Tabs filtrables (Tous / Actifs / Inactifs / Populaires) : alignés sur
 *     le pattern méthodologie (overview-filters.tsx), avec une couleur teintée
 *     par tab quand actif.
 *   - Search bar : match `name`, `slug`, `description` (côté workspace).
 *   - Catégorie : select shadcn pour filtrer par ToolSection.
 *
 * Aucune logique métier ici : tout est props-driven (workspace orchestre).
 */
export function FiltersBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  counts,
  sections,
}: FiltersBarProps) {
  const tabs: TabDef[] = [
    { id: "all", label: `Tous (${counts.total})`, tone: "violet" },
    { id: "active", label: `Actifs (${counts.active})`, tone: "emerald" },
    { id: "inactive", label: `Inactifs (${counts.inactive})`, tone: "red" },
    { id: "popular", label: `Populaires (${counts.popular})`, tone: "amber" },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Filtres outils"
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

      {/* Recherche + catégorie ---------------------------------------- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Rechercher un outil"
            placeholder="Rechercher un outil..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => onCategoryChange(v ?? "all")}
        >
          <SelectTrigger
            className="h-9 w-full sm:w-44"
            aria-label="Filtrer par catégorie"
          >
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
