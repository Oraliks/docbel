"use client";

import { useMemo, useState } from "react";
import type { CalcMethodology } from "@/lib/calculators/_methodology";
import { OverviewStats } from "./overview-stats";
import { OverviewFilters } from "./overview-filters";
import { OverviewGrid } from "./overview-grid";
import type { ReliabilityFilter } from "./types";

interface OverviewShellProps {
  methodologies: CalcMethodology[];
}

/**
 * Orchestre l'état client de la page d'overview admin des méthodologies :
 *   - filtre par fiabilité (tab actif)
 *   - recherche full-text (titre + pitch, insensible à la casse)
 *
 * Reçoit la liste brute des methodologies depuis le server component
 * parent. Calcule les compteurs sur la liste totale (non filtrée) puis
 * applique les filtres pour la grille affichée.
 */
export function OverviewShell({ methodologies }: OverviewShellProps) {
  const [selected, setSelected] = useState<ReliabilityFilter>("all");
  const [search, setSearch] = useState("");

  /** Compteurs globaux — toujours basés sur la liste totale. */
  const counts = useMemo(() => {
    const acc = { high: 0, medium: 0, low: 0, total: methodologies.length };
    for (const m of methodologies) {
      acc[m.reliability] += 1;
    }
    return acc;
  }, [methodologies]);

  /** Liste filtrée par tab + recherche. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return methodologies.filter((m) => {
      if (selected !== "all" && m.reliability !== selected) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.pitch.toLowerCase().includes(q)
      );
    });
  }, [methodologies, selected, search]);

  function resetFilters() {
    setSelected("all");
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-4">
      <OverviewStats counts={counts} />
      <OverviewFilters
        selected={selected}
        onSelectedChange={setSelected}
        search={search}
        onSearchChange={setSearch}
        counts={counts}
      />
      <OverviewGrid
        methodologies={filtered}
        onResetFilters={resetFilters}
      />
    </div>
  );
}
