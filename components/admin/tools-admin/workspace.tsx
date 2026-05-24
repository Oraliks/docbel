"use client";

import { useMemo, useState } from "react";
import { SearchX, Wrench } from "lucide-react";
import { StatsCards } from "./stats-cards";
import { FiltersBar } from "./filters-bar";
import { SectionGroup } from "./section-group";
import type { Section, StatusFilter, Tool } from "./types";

interface Props {
  sections: Section[];
}

/**
 * Page admin /outils refondue (2026-05). Orchestre l'état client :
 *   - en-tête (icône + titre + sous-titre)
 *   - 4 stats cards (Total / Actifs / Inactifs / Populaires) avec bordure
 *     gauche colorée — pattern aligné sur la méthodologie des calculateurs
 *   - barre de filtres : tabs colorés (statut) + search + select catégorie
 *   - groupes de sections plats (header simple + grille 2 col de cards)
 *
 * Pas d'accordéon (la version précédente collapsait par section). Avec ~14
 * outils en DB et 3 sections, le coût visuel d'afficher tout est faible
 * et la suppression des clics inutiles améliore l'UX admin.
 *
 * Les `ToolCard` font leurs propres PATCH /api/tools/[slug] et déclenchent
 * un `router.refresh()` après chaque modif (resync des sections SSR).
 */
export function ToolsAdminWorkspace({ sections }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  /** Compteurs globaux — calculés sur la liste totale, jamais sur le filtre. */
  const counts = useMemo(() => {
    const tools = sections.flatMap((s) => s.tools);
    return {
      total: tools.length,
      active: tools.filter((t) => t.active).length,
      inactive: tools.filter((t) => !t.active).length,
      popular: tools.filter((t) => t.popular).length,
    };
  }, [sections]);

  /** Liste des sections après application des filtres. */
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();

    function matches(tool: Tool): boolean {
      if (status === "active" && !tool.active) return false;
      if (status === "inactive" && tool.active) return false;
      if (status === "popular" && !tool.popular) return false;
      if (!q) return true;
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.slug.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q)
      );
    }

    return sections
      .filter((s) => category === "all" || s.id === category)
      .map((s) => ({
        ...s,
        tools: [...s.tools].filter(matches).sort((a, b) => a.order - b.order),
      }))
      .filter((s) => s.tools.length > 0);
  }, [sections, search, category, status]);

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setStatus("all");
  }

  const hasResults = filteredSections.length > 0;
  const visibleCount = filteredSections.reduce(
    (acc, s) => acc + s.tools.length,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête ------------------------------------------------------- */}
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
          <Wrench className="size-5" />
        </span>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold leading-tight">Outils</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} outils — active, désactive ou modifie chaque outil
            du catalogue public.
          </p>
        </div>
      </header>

      {/* Stats --------------------------------------------------------- */}
      <StatsCards counts={counts} />

      {/* Filtres ------------------------------------------------------- */}
      <FiltersBar
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        status={status}
        onStatusChange={setStatus}
        counts={counts}
        sections={sections}
      />

      {/* Résultats ---------------------------------------------------- */}
      {hasResults ? (
        <>
          {(search.trim() || status !== "all" || category !== "all") && (
            <p className="text-[11.5px] text-muted-foreground">
              {visibleCount}{" "}
              {visibleCount === 1 ? "outil trouvé" : "outils trouvés"}
            </p>
          )}
          <div className="flex flex-col gap-5">
            {filteredSections.map((s) => (
              <SectionGroup key={s.id} section={s} tools={s.tools} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <SearchX className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Aucun outil ne correspond à ces critères.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
