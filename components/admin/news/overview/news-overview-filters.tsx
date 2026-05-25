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
import type { NewsCounts, NewsStatusFilter } from "./types";

interface NewsOverviewFiltersProps {
  status: NewsStatusFilter;
  onStatusChange: (value: NewsStatusFilter) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
  search: string;
  onSearchChange: (value: string) => void;
  counts: NewsCounts;
}

interface TabDef {
  id: NewsStatusFilter;
  label: string;
  tone: "violet" | "emerald" | "amber" | "slate";
}

const TONE_ACTIVE: Record<TabDef["tone"], string> = {
  violet: "bg-primary/10 text-primary border-primary/30 dark:bg-primary/15",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber:
    "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300",
  slate:
    "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
};

/**
 * Barre de filtres pour la page d'overview admin /admin/news.
 *
 * Layout responsive — mobile : empilé / desktop : tabs à gauche, search +
 * catégorie à droite. Pattern aligné sur `tools-admin/filters-bar.tsx` et
 * `calculateurs/overview/overview-filters.tsx`.
 *
 *   - Tabs (Tous / Publiés / Brouillons / Planifiés) : chaque tab affiche
 *     son compteur et prend une teinte colorée quand actif.
 *   - Select catégorie : populé dynamiquement par la liste passée en props.
 *   - Search bar : match titre + excerpt (côté shell).
 */
export function NewsOverviewFilters({
  status,
  onStatusChange,
  category,
  onCategoryChange,
  categories,
  search,
  onSearchChange,
  counts,
}: NewsOverviewFiltersProps) {
  const tabs: TabDef[] = [
    { id: "all", label: `Tous (${counts.total})`, tone: "violet" },
    {
      id: "published",
      label: `Publiés (${counts.published})`,
      tone: "emerald",
    },
    {
      id: "draft",
      label: `Brouillons (${counts.draft})`,
      tone: "amber",
    },
    {
      id: "scheduled",
      label: `Planifiés (${counts.scheduled})`,
      tone: "violet",
    },
    {
      id: "archived",
      label: `Archivés (${counts.archived})`,
      tone: "slate",
    },
  ];

  return (
    <div
      role="toolbar"
      aria-label="Filtres articles"
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
            aria-label="Rechercher un article"
            placeholder="Rechercher un article..."
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
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
